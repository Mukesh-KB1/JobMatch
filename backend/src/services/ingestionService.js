import { config } from '../config/env.js';
import { jobRepository } from '../repositories/jobRepository.js';
import { resumeRepository } from '../repositories/resumeRepository.js';
import { ingestionStateRepository } from '../repositories/ingestionStateRepository.js';
import { fetchAdzunaPage, fetchJoobleResults, fetchArbeitnowBoard } from './jobSourceClients.js';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// Resume-driven queries: blend the top N skills aggregated across all users'
// active, parsed resumes with a small generic fallback list (used before any
// resumes exist). Keeps the pool skewed toward what real users need matched.
export async function buildQueryPool() {
  const top = await resumeRepository.aggregateTopSkills(config.ingestion.resumeSkillPoolSize);
  const resumeQueries = top.map((t) => t._id);
  const generic = config.ingestion.genericQueries;
  // De-duplicate while preserving generic terms as a guaranteed floor.
  const merged = Array.from(new Set([...resumeQueries, ...generic]));
  return merged;
}

export function buildAdzunaPairs(queries) {
  const pairs = [];
  for (const query of queries) {
    for (const country of config.adzuna.countries) {
      pairs.push({ query, country });
    }
  }
  return pairs;
}

// Advances a persisted rotation cursor through `list`, consuming up to
// `count` items and wrapping around at the end. Cursor is read/written via
// the IngestionState collection so a server restart doesn't reset progress.
export async function takeRotatingSlice(key, list, count) {
  if (list.length === 0) return { slice: [], nextCursor: 0 };
  const cursor = await ingestionStateRepository.getCursor(key);
  const slice = [];
  for (let i = 0; i < count; i++) {
    slice.push(list[(cursor + i) % list.length]);
  }
  const nextCursor = (cursor + count) % list.length;
  await ingestionStateRepository.setCursor(key, nextCursor);
  return { slice, nextCursor };
}

async function ingestAdzunaPairs(pairs) {
  let count = 0;
  for (const { query, country } of pairs) {
    try {
      const jobs = await fetchAdzunaPage({ query, country });
      for (const job of jobs) {
        await jobRepository.upsertFromSource(job);
      }
      count++;
    } catch (err) {
      console.error(`[ingestion] Adzuna failed for query="${query}" country="${country}":`, err.message);
    }
  }
  return count;
}

async function ingestJoobleQueries(queries) {
  let count = 0;
  for (const query of queries) {
    try {
      const jobs = await fetchJoobleResults({ query });
      for (const job of jobs) {
        await jobRepository.upsertFromSource(job);
      }
      count++;
    } catch (err) {
      console.error(`[ingestion] Jooble failed for query="${query}":`, err.message);
    }
  }
  return count;
}

async function ingestArbeitnow() {
  try {
    const jobs = await fetchArbeitnowBoard();
    for (const job of jobs) {
      await jobRepository.upsertFromSource(job);
    }
    return jobs.length;
  } catch (err) {
    console.error('[ingestion] Arbeitnow failed:', err.message);
    return 0;
  }
}

// Regular scheduled run: consumes only a capped slice of the pool per run,
// tracked by the persisted rotation cursor. Math that must hold:
//   callsPerRun * runsPerDay < ~230 (buffer below Adzuna's 250/day cap).
export async function runRotatingIngestion() {
  const queries = await buildQueryPool();
  const adzunaPairs = buildAdzunaPairs(queries);

  const { slice: adzunaSlice } = await takeRotatingSlice('adzuna', adzunaPairs, config.adzuna.callsPerRun);
  const { slice: joobleSlice } = await takeRotatingSlice('jooble', queries, config.jooble.callsPerRun);

  const adzunaCount = await ingestAdzunaPairs(adzunaSlice);
  const joobleCount = await ingestJoobleQueries(joobleSlice);
  const arbeitnowCount = await ingestArbeitnow();

  await deactivateStaleJobs();

  return { adzunaCount, joobleCount, arbeitnowCount };
}

// One-time bootstrap: loops through the ENTIRE (query x country) pair list in
// one run (not capped to the per-run budget), throttled to stay under
// Adzuna's 25/minute limit, and stops itself before exceeding the daily cap
// (leaving ~20 in reserve for the regular rotation that day). Idempotent -
// safe to re-run since writes are upserts.
export async function runBootstrapSync({
  throttleMs = 2500,
  dailyCapReserve = 20,
  log = console.log,
} = {}) {
  const queries = await buildQueryPool();
  const adzunaPairs = buildAdzunaPairs(queries);
  const maxCalls = Math.max(0, config.adzuna.dailyCap - dailyCapReserve);

  let calls = 0;
  let jobsUpserted = 0;
  for (const { query, country } of adzunaPairs) {
    if (calls >= maxCalls) {
      log(`[bootstrap] Reached the safe daily-cap budget (${maxCalls} calls). Stopping early.`);
      break;
    }
    try {
      const jobs = await fetchAdzunaPage({ query, country });
      for (const job of jobs) {
        await jobRepository.upsertFromSource(job);
        jobsUpserted++;
      }
      log(`[bootstrap] Adzuna "${query}" / ${country}: ${jobs.length} jobs`);
    } catch (err) {
      log(`[bootstrap] Adzuna failed for "${query}" / ${country}: ${err.message}`);
    }
    calls++;
    await sleep(throttleMs);
  }

  const joobleCount = await ingestJoobleQueries(queries);
  const arbeitnowCount = await ingestArbeitnow();

  await deactivateStaleJobs();

  return { adzunaCalls: calls, jobsUpserted, joobleCount, arbeitnowCount };
}

// Startup guard: node-cron only fires at its scheduled clock ticks (e.g. on
// the hour / half hour), never immediately on process start. In local dev
// the server is frequently stopped and restarted well before the next tick,
// so the pool's "last updated" timestamp can sit stale for hours even
// though the app looks freshly started. This checks how old the pool
// actually is and, if it's past the configured threshold, kicks off one
// rotating ingestion run right away (respecting the same per-run API
// budget as the cron) instead of waiting for the next scheduled tick.
export async function ensureFreshPoolOnStartup({ log = console.log } = {}) {
  const mostRecent = await jobRepository.mostRecentlyUpdated();
  const staleMs = config.ingestion.startupRefreshStaleMinutes * 60 * 1000;
  const isStale = !mostRecent || Date.now() - new Date(mostRecent.updatedAt).getTime() > staleMs;

  if (!isStale) {
    log('[startup] Job pool is fresh, skipping startup ingestion run.');
    return null;
  }

  log(`[startup] Job pool is stale (>${config.ingestion.startupRefreshStaleMinutes}min), running ingestion now...`);
  try {
    const result = await runRotatingIngestion();
    log('[startup] Startup ingestion run complete:', result);
    return result;
  } catch (err) {
    log('[startup] Startup ingestion run failed:', err.message);
    return null;
  }
}

export async function deactivateStaleJobs() {
  const staleBeforeDate = new Date(Date.now() - config.ingestion.jobStaleDays * 24 * 60 * 60 * 1000);
  return jobRepository.deactivateStale(staleBeforeDate);
}

export const ingestionService = {
  buildQueryPool,
  buildAdzunaPairs,
  takeRotatingSlice,
  runRotatingIngestion,
  runBootstrapSync,
  ensureFreshPoolOnStartup,
  deactivateStaleJobs,
};
