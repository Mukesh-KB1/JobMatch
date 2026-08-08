// One-time setup command: npm run bootstrap-jobs
//
// Loops through the ENTIRE (query x country) pair list in one run so a
// freshly deployed instance has a rich, browsable job pool immediately,
// instead of waiting ~10+ hours for the rotating cron to build up coverage.
// Throttled to stay under Adzuna's 25/minute limit and stops itself before
// exceeding the daily 250 cap. Idempotent - safe to re-run (writes upsert).
//
// This is a ONE-TIME command to run right after setup, not something to
// schedule - the rotating cron (src/cron/scheduler.js) handles ongoing
// ingestion within the daily budget.
import { connectDB, disconnectDB } from '../config/db.js';
import { runBootstrapSync } from '../services/ingestionService.js';

async function main() {
  await connectDB();
  console.log('[bootstrap-jobs] Connected to MongoDB. Starting full pool sync...');

  const result = await runBootstrapSync({ throttleMs: 2500, dailyCapReserve: 20 });

  console.log('[bootstrap-jobs] Done.');
  console.log(`  Adzuna calls made: ${result.adzunaCalls}`);
  console.log(`  Jobs upserted (Adzuna, cumulative across sources follow): ${result.jobsUpserted}`);
  console.log(`  Jooble queries run: ${result.joobleCount}`);
  console.log(`  Arbeitnow jobs upserted: ${result.arbeitnowCount}`);

  await disconnectDB();
  process.exit(0);
}

main().catch((err) => {
  console.error('[bootstrap-jobs] Failed:', err);
  process.exit(1);
});
