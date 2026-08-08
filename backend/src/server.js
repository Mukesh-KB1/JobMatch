import { createApp } from './app.js';
import { connectDB } from './config/db.js';
import { config } from './config/env.js';
import { startCronJobs } from './cron/scheduler.js';
import { ensureFreshPoolOnStartup } from './services/ingestionService.js';

async function main() {
  await connectDB();
  console.log('[server] Connected to MongoDB');

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`[server] JobMatch API listening on port ${config.port} (${config.nodeEnv})`);
  });

  // In-process scheduling per the spec (node-cron). For a multi-instance
  // deployment you'd want a single designated scheduler instance, but for
  // this project's free-tier single-instance deploy this is sufficient.
  startCronJobs();
  console.log('[server] Cron jobs scheduled');

  // node-cron never fires immediately on boot, only at its next scheduled
  // tick - so a server that's frequently restarted in dev could go a long
  // time between real ingestion runs. Fire-and-forget a check here: if the
  // pool is older than STARTUP_REFRESH_STALE_MINUTES, refresh it right now
  // instead of waiting. Not awaited, so it never delays server startup.
  ensureFreshPoolOnStartup().catch((err) => {
    console.error('[server] Startup pool freshness check failed:', err);
  });
}

main().catch((err) => {
  console.error('[server] Fatal startup error:', err);
  process.exit(1);
});
