import cron from 'node-cron';
import { config } from '../config/env.js';
import { runRotatingIngestion } from '../services/ingestionService.js';
import { matchDigestService } from '../services/matchDigestService.js';
import { resumeRepository } from '../repositories/resumeRepository.js';
import { userRepository } from '../repositories/userRepository.js';
import { matchService } from '../services/matchService.js';

// Hourly cron: scores every user's active resume against unmatched pool jobs.
async function scoreAllUsersUnmatchedJobs() {
  // Iterate every user who has an active parsed resume - scoring runs
  // regardless of email digest opt-in (opt-in only gates emailing).
  const allUsers = await userRepository.findAll();
  for (const user of allUsers) {
    const resume = await resumeRepository.findActiveForUser(user._id);
    if (!resume) continue;
    await matchService.scoreUnmatchedJobsForUser(user._id, resume, { maxPerRun: 10, delayMs: 1200 });
  }
}

export function startCronJobs() {
  const jobs = [];

  jobs.push(
    cron.schedule(config.cron.jobIngestion, async () => {
      try {
        const result = await runRotatingIngestion();
        console.log('[cron] job ingestion run complete:', result);
      } catch (err) {
        console.error('[cron] job ingestion run failed:', err);
      }
    })
  );

  jobs.push(
    cron.schedule(config.cron.delayedMatch, async () => {
      try {
        await scoreAllUsersUnmatchedJobs();
        console.log('[cron] delayed match scoring run complete');
      } catch (err) {
        console.error('[cron] delayed match scoring run failed:', err);
      }
    })
  );

  jobs.push(
    cron.schedule(config.cron.dailyDigest, async () => {
      try {
        const result = await matchDigestService.runDailyDigest();
        console.log('[cron] daily digest run complete:', result.length, 'users processed');
      } catch (err) {
        console.error('[cron] daily digest run failed:', err);
      }
    })
  );

  jobs.push(
    cron.schedule(config.cron.loginDigestSweep, async () => {
      try {
        const result = await matchDigestService.runLoginDigestSweep();
        if (result.length) console.log('[cron] login digest sweep sent', result.length, 'digests');
      } catch (err) {
        console.error('[cron] login digest sweep failed:', err);
      }
    })
  );

  return jobs;
}
