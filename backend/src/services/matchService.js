import { matchRepository } from '../repositories/matchRepository.js';
import { jobRepository } from '../repositories/jobRepository.js';
import { resumeRepository } from '../repositories/resumeRepository.js';
import { applicationRepository } from '../repositories/applicationRepository.js';
import { scoreResumeAgainstJob } from './geminiClient.js';
import { keywordOverlapScore } from '../utils/skillsDictionary.js';
import { HttpError } from '../middleware/errorHandler.js';

// Clamped here too, defensively, even though geminiClient already clamps -
// this is the last line of defense before the score hits the DB, so it
// stays correct even if the AI client is swapped, mocked, or misbehaves.
function clampScore(raw) {
  const n = Number(raw);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

async function scoreAndUpsert({ userId, resume, job, matchedVia }) {
  const result = await scoreResumeAgainstJob({ resumeText: resume.parsedText, job });
  return matchRepository.upsert({
    userId,
    jobId: job._id,
    resumeId: resume._id,
    score: clampScore(result.score),
    summary: result.summary,
    strengths: result.strengths,
    gaps: result.gaps,
    matchedVia,
  });
}

export const matchService = {
  // "Score my fit" button - immediate, on-demand scoring for one job.
  async scoreJobForUser(userId, jobId) {
    const resume = await resumeRepository.findActiveForUser(userId);
    if (!resume) {
      throw new HttpError(400, 'Upload and parse a resume before requesting a match score.');
    }
    const job = await jobRepository.findByIdActive(jobId);
    if (!job) {
      throw new HttpError(404, 'Not found.');
    }
    return scoreAndUpsert({ userId, resume, job, matchedVia: 'immediate' });
  },

  // Background cron: score every user's active resume against pool jobs
  // they haven't been matched against yet, throttled between Gemini calls.
  async scoreUnmatchedJobsForUser(userId, resume, { maxPerRun = 10, delayMs = 1200 } = {}) {
    const existingMatches = await matchRepository.listForUser(userId);
    const alreadyMatchedJobIds = existingMatches.map((m) => m.jobId);
    const candidates = await jobRepository.listActiveIdsNotIn(alreadyMatchedJobIds);
    const slice = candidates.slice(0, maxPerRun);

    const results = [];
    for (const job of slice) {
      try {
        const match = await scoreAndUpsert({ userId, resume, job, matchedVia: 'delayed_cron' });
        results.push(match);
      } catch (err) {
        console.error(`[matchService] scoring failed for user=${userId} job=${job._id}:`, err.message);
      }
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
    }
    return results;
  },

  listForUser(userId) {
    return matchRepository.listForUser(userId);
  },

  // Merges precomputed match scores into a job listing without any extra
  // Gemini calls, and falls back to cheap keyword-overlap sorting for jobs
  // that haven't been scored yet.
  async listJobsWithScores(userId, { skip = 0, limit = 20, country = '', search = '' } = {}) {
    // Fetch the resume first (not in parallel with jobs) because, when the
    // user hasn't typed an explicit search, we use their resume's own top
    // skills as an IMPLICIT search. Without this, "relevant jobs first"
    // only ever applied within whatever single page got fetched by
    // recency - a MERN-stack resume's best-fit jobs could be sitting on
    // page 6 and never surface. Routing through the same weighted text
    // index used by manual search fixes that: MongoDB ranks the ENTIRE
    // active pool by skill relevance before pagination even happens.
    const resume = await resumeRepository.findActiveForUser(userId);
    const effectiveSearch = search || (resume?.skills?.length ? resume.skills.slice(0, 8).join(' ') : '');

    const jobs = await jobRepository.listActive({ skip, limit, country, search: effectiveSearch });
    const jobIds = jobs.map((j) => j._id);
    const [matches, applications] = await Promise.all([
      matchRepository.findManyForUserByJobIds(userId, jobIds),
      applicationRepository.listJobIdsForUser(userId, jobIds),
    ]);
    const matchByJobId = new Map(matches.map((m) => [String(m.jobId), m]));
    const appliedJobIds = new Set(applications.map((a) => String(a.jobId)));

    const enriched = jobs.map((job) => {
      const match = matchByJobId.get(String(job._id));
      const keywordScore = resume ? keywordOverlapScore(resume.skills, job.requiredSkills) : 0;
      return {
        job,
        aiMatch: match
          ? { score: match.score, summary: match.summary, strengths: match.strengths, gaps: match.gaps }
          : null,
        relevance: match ? match.score : keywordScore,
        applied: appliedJobIds.has(String(job._id)),
      };
    });

    // With an EXPLICIT search (the user actually typed something), `jobs`
    // came back ordered by MongoDB's text relevance to that literal query -
    // that ordering IS the point of searching, so it's preserved exactly.
    // Otherwise (no explicit search - whether or not an implicit one was
    // used above to pick the candidate pool), re-sort by actual fit: cached
    // AI match score where one exists, keyword overlap otherwise. This is
    // what puts "Score my fit"-confirmed matches above merely
    // skill-adjacent jobs within the page.
    if (!search) {
      enriched.sort((a, b) => b.relevance - a.relevance);
    }
    return enriched;
  },
};