# JobMatch

AI-scored job matching for job seekers who are tired of re-reading the same posting five
times to guess whether they're qualified. Create an account, upload a resume, and JobMatch
pulls real postings from free job-board APIs (India + worldwide), scores your fit against
each one with Gemini, and emails you your best matches — all on free-tier infrastructure.
It's built for job seekers doing an active search and wants a running shortlist instead of
a firehose of postings, and it's also a portfolio piece demonstrating a MERN stack with
real security and operational constraints taken seriously (IDOR-safe data access, API-quota
budgeting, dedupe-safe background jobs).

---

## 1. Architecture

```
jobmatch/
├── backend/
│   ├── src/
│   │   ├── config/         env loading, Mongo connection, multer upload config
│   │   ├── models/         Mongoose schemas (User, Resume, Job, Match, Application,
│   │   │                   DigestLog, IngestionState)
│   │   ├── repositories/   ALL Mongo access lives here. Every user-owned lookup takes
│   │   │                   userId as a required filter argument (see section 5).
│   │   ├── services/       business logic (auth, resumes, matching, ingestion, digests)
│   │   ├── routes/         thin Express routers - parse input, call a service, respond
│   │   ├── middleware/     JWT auth, generic ownership loader, rate limiting, errors
│   │   ├── cron/           node-cron wiring for the four scheduled jobs
│   │   ├── scripts/        bootstrap-jobs (one-time) and seed (demo data)
│   │   └── app.js / server.js
│   └── tests/              Jest + Supertest + mongodb-memory-server
└── frontend/
    ├── src/
    │   ├── pages/           one component per route (Login, Jobs, Resume, Applied, ...)
    │   ├── components/      ScoreGauge, JobCard, Navbar, GoogleSignInButton, Feedback
    │   ├── context/         AuthContext (token + current user)
    │   ├── api/             a single fetch-based client wrapping every backend endpoint
    │   └── styles/           the "signal scanner" design tokens (see section 6)
    └── (Vite + React Router)
```

**Request flow, always**: `route → service → repository → Mongoose`. Routes never import a
Mongoose model directly. This isn't just style - it's what makes the ownership guarantee in
section 5 possible to state and test as one rule instead of re-litigating it per route.

---

## 2. Prerequisites — register for these free API keys first

| Service | What it's for | Where to get it |
|---|---|---|
| Adzuna | Job postings (free tier: 250 calls/day, 25/min) | https://developer.adzuna.com/ |
| Jooble | Job postings (free tier, no published cap) | https://jooble.org/api/about |
| Google Cloud Console | OAuth client ID for "Sign in with Google" | https://console.cloud.google.com/apis/credentials |
| Google AI Studio | Gemini API key for match scoring | https://aistudio.google.com/app/apikey |
| Brevo (recommended) | Free SMTP relay (300 emails/day) for digests | https://app.brevo.com/settings/keys/smtp |
| Gmail SMTP (alternative) | Low-volume SMTP if you'd rather not sign up for Brevo | Use `smtp.gmail.com:587` with a Google App Password |

Arbeitnow needs no key at all.

---

## 3. Backend setup

```bash
cd backend
cp .env.example .env
# fill in MONGO_URI, JWT_SECRET, GEMINI_API_KEY, GOOGLE_CLIENT_ID, SMTP_*, ADZUNA_*, JOOBLE_*
npm install
npm run dev
```

Once the server is running, in a second terminal, run the **one-time bootstrap sync** so
the job pool isn't empty on day one:

```bash
npm run bootstrap-jobs
```

This is a one-time command (see section 7) - not something to add to a cron schedule
yourself, the app already schedules ongoing ingestion internally.

Optionally, seed a handful of realistic demo jobs instantly (no API keys required):

```bash
npm run seed
```

---

## 4. Frontend setup

```bash
cd frontend
cp .env.example .env
# set VITE_GOOGLE_CLIENT_ID to the SAME value as the backend's GOOGLE_CLIENT_ID
npm install
npm run dev
```

---

## 5. IDOR / ownership security model

Every resource a user can own - a `Resume`, `Match`, or `Application` - is looked up with
`userId` baked directly into the Mongo query filter, never fetched first and checked after:

```js
// CORRECT - userId is a query filter, in repositories/resumeRepository.js
findByIdForUser(id, userId) { return Resume.findOne({ _id: id, userId }); }

// WRONG - never do this anywhere in this codebase
async findById(id, userId) {
  const doc = await Resume.findById(id);
  if (doc.userId !== userId) throw new Error('forbidden');
  return doc;
}
```

`middleware/ownership.js` wraps any such loader into route middleware:

```js
router.get('/:id', requireAuth, loadOwned(resumeRepository.findByIdForUser, 'resume'), handler);
```

If the id doesn't exist, or exists but belongs to someone else, the response is a plain
**404** - never a 403. The API must never confirm that a foreign resource exists at all.
`req.user.id`, taken only from the verified JWT, is the sole source of truth for "who is
asking" - no route ever trusts a `userId` in params or body for authorization.

The full cross-user access suite lives at `backend/tests/integration/ownership.test.js` and
proves, for every owned resource type, that another user gets a 404 (not the data, not a
403) via GET, DELETE, and list endpoints - plus that malformed ids 404 instead of 500ing,
and that unauthenticated requests are rejected with 401 before ownership is even evaluated.

---

## 6. Design: the "signal scanner"

The app's visual identity treats the whole product like an instrument scanning for a
signal - a job that fits. A match score is a radial gauge with tick marks like a real dial
(`components/ScoreGauge.jsx`), not a progress bar, color-banded green (≥75) / amber (50-74)
/ red (<50). Data - scores, timestamps, source labels - is set in JetBrains Mono so it reads
as instrument readout, while headings use Space Grotesk and body copy uses Inter. Tokens
live in `frontend/src/styles/tokens.css`.

---

## 7. Job ingestion: rotation budget and bootstrap sync

**The constraint**: Adzuna's free tier allows 250 calls/day and 25/minute. Jooble's free
tier has no published limit, so it's treated defensively the same way. Arbeitnow needs no
key and one call returns the entire current board.

**Regular rotation (ongoing)**: the full list of `(searchQuery × country)` pairs for Adzuna
(and `(searchQuery)` pairs for Jooble) is built from a blend of the top skills aggregated
across all users' active resumes plus a small generic fallback list. Each scheduled run
(`JOB_INGESTION_CRON`, default every 30 minutes) only consumes a capped slice of that list -
`ADZUNA_CALLS_PER_RUN` (default 4) and `JOOBLE_CALLS_PER_RUN` (default 2) - tracked by a
rotation cursor persisted in the `IngestionState` collection, so a server restart doesn't
reset progress. The math that must hold, with current defaults:

```
runs/day = 24h × (60 / 30min) = 48 runs/day
Adzuna:  4 calls/run × 48 runs/day = 192 calls/day   (buffer: 58 under the 250 cap)
Jooble:  2 calls/run × 48 runs/day = 96  calls/day   (treated conservatively, no published cap)
```

If you shorten the cron interval or raise `ADZUNA_CALLS_PER_RUN`, re-check this math against
the 250/day cap before deploying.

**One-time bootstrap sync** (`npm run bootstrap-jobs`): loops through the *entire*
`(query × country)` pair list in one run - not capped to the small per-run budget - so a
freshly deployed instance has a rich, browsable job pool immediately instead of waiting
~10+ hours for the rotating cron to build up coverage. It's throttled to one call every 2.5
seconds (well under Adzuna's 25/minute cap) and stops itself if it's about to exceed the
daily 250 cap, leaving 20 calls in reserve for the regular rotation that same day. It's
idempotent (writes upsert by `source + externalId`), so it's safe to re-run, but it is a
**one-time setup command**, not something to schedule.

**Dedupe and staleness**: every write upserts by `(source, externalId)`, so re-ingesting an
already-known listing updates it in place rather than duplicating it. A posting no
ingestion source has reconfirmed within `JOB_STALE_DAYS` (default 21) is set `isActive:
false` - never deleted - so a stale role stops appearing without losing its history.
Manually-created jobs (`source: 'manual'`) are never auto-deactivated.

**Freshness is surfaced, not implied**: `GET /api/jobs/meta/freshness` returns the active
job count and the most recent update timestamp, and the Jobs page shows it plainly ("X
active jobs · pool last updated Yh ago") rather than claiming real-time freshness the design
doesn't actually provide.

---

## 8. Email digests: two mechanisms, one shared dedupe flag

**Daily digest** (`DAILY_DIGEST_CRON`, default 7am): every verified, opted-in user with
unsent matches scoring ≥ `LOGIN_DIGEST_MIN_SCORE` (default 70) gets emailed up to 10 of
them. Each included match is marked `includedInDigestAt` only after a successful send, so a
failed send can safely retry on the next run without needing separate failure-tracking
logic.

**Login-triggered digest**: on every successful login (password or Google) or completed
password reset, a one-time "best matches" email is queued for `LOGIN_DIGEST_DELAY_MINUTES`
(default 120) minutes later - but only if:
- the user is verified and opted in, and
- nothing is **already queued** (repeated logins don't reschedule it), and
- nothing was **sent within `LOGIN_DIGEST_DEDUPE_HOURS`** (default 20h) of now.

A sweep cron (`LOGIN_DIGEST_SWEEP_CRON`, default every 15 minutes) sends to users whose
queued time has arrived, using the same "unsent, ≥ threshold score" logic as the daily
digest, then clears the queue flag.

Both mechanisms share the same `Match.includedInDigestAt` flag, so whichever one fires
first for a given match "claims" it - the other will simply find nothing left to send for
that match, rather than double-emailing it.

---

## 9. Testing

**Backend**:
```bash
cd backend
npm test
```
Runs on Jest + Supertest + `mongodb-memory-server`, entirely offline - no real database, no
real calls to Gemini, Adzuna, Jooble, or SMTP. Any test file touching Gemini or the mailer
mocks it explicitly with `jest.unstable_mockModule`. Coverage includes the full auth flow
(register/login/Google linking/verification/reset), the ownership/IDOR suite described in
section 5, match scoring (clamping + upsert-not-duplicate), digest logic (score threshold,
opt-out, dedupe), ingestion rotation (cursor advance/wrap/persistence per source), and
stale-job deactivation.

**Frontend**:
```bash
cd frontend
npm test
```
Runs on Vitest + Testing Library, covering the score gauge (band labels, clamping,
accessible name) and a data-fetching page exercising loading / empty / populated states.

---

## 10. Deployment

**Docker (local or any container host)**:
```bash
docker compose up --build
```
This starts MongoDB, the backend API, and the frontend dev server together. See
`docker-compose.yml` at the repo root; `backend/Dockerfile` and `frontend/Dockerfile` are
standalone if you want to build/push them individually.

**Managed free hosts (recommended for a real deployment)**:
- **Backend** → Render or Fly.io (Node web service). Set every variable from
  `backend/.env.example` in the host's environment/secrets UI. Make sure the always-on cron
  jobs actually run - free tiers that spin down on idle will pause the schedulers, so pick a
  plan/host combination that keeps the process alive, or trigger the cron endpoints via an
  external scheduler (e.g. cron-job.org hitting a small internal trigger route) as a
  workaround.
- **Frontend** → Vercel or Netlify. Set `VITE_API_BASE_URL` to your deployed backend's URL
  and `VITE_GOOGLE_CLIENT_ID` to match the backend.
- **Database** → MongoDB Atlas free tier (M0). Use its connection string as `MONGO_URI`.

After the backend is live, run `npm run bootstrap-jobs` once (locally, pointed at the
production `MONGO_URI`, or via a one-off job on your host) to populate the pool immediately.

---

## 11. Known limitations

- Free-tier API caps mean the job pool is **not truly real-time** - Adzuna's 250/day cap in
  particular means full coverage of every query/country pair takes hours to fully rotate
  through on an ongoing basis (the bootstrap sync exists specifically to avoid a bare pool
  on day one, but even it stops short of the cap with a safety margin).
- The resume-driven query pool is only as good as the skill dictionary
  (`utils/skillsDictionary.js`) and the generic fallback terms - a resume in a very niche
  field may not surface much until you add matching terms to the dictionary and query list.
- Match scoring quality depends entirely on Gemini's output; scores and summaries are
  AI-generated judgments, not guarantees, and the UI labels them as such.
- Jooble's lack of a published rate limit means its budget (`JOOBLE_CALLS_PER_RUN`) is a
  conservative guess, not a documented constraint - tighten it if you see errors.
- Single-instance in-process cron scheduling (`node-cron`) assumes one running backend
  instance. Running multiple instances would double-fire every scheduled job unless you add
  a distributed lock or move to an external scheduler.
