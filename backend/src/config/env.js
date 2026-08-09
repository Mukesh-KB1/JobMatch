// Central place that reads process.env once, applies sane defaults, and
// exposes a typed-ish config object. Every env var listed in .env.example
// must be read somewhere from here (or explicitly from process.env in a
// script) - no dead config, per the project's definition of done.
import dotenv from 'dotenv';
dotenv.config();

function num(name, fallback) {
  const v = process.env[name];
  return v === undefined || v === '' ? fallback : Number(v);
}
function list(name, fallback = []) {
  const v = process.env[name];
  if (!v) return fallback;
  return v.split(',').map((s) => s.trim()).filter(Boolean);
}

export const config = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: num('PORT', 5000),
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/jobmatch',

  jwtSecret: process.env.JWT_SECRET || 'dev_only_insecure_secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-2.0-flash',
  },

  googleClientId: process.env.GOOGLE_CLIENT_ID || '',

  brevo: {
    apiKey: process.env.BREVO_API_KEY || '',
    fromEmail: process.env.DIGEST_FROM_EMAIL || 'no-reply@jobmatch.local',
    fromName: process.env.DIGEST_FROM_NAME || 'JobMatch',
  },

  adzuna: {
    appId: process.env.ADZUNA_APP_ID || '',
    appKey: process.env.ADZUNA_APP_KEY || '',
    countries: list('ADZUNA_COUNTRIES', ['in', 'gb', 'us']),
    callsPerRun: num('ADZUNA_CALLS_PER_RUN', 4),
    dailyCap: 250,
    perMinuteCap: 25,
  },

  jooble: {
    apiKey: process.env.JOOBLE_API_KEY || '',
    callsPerRun: num('JOOBLE_CALLS_PER_RUN', 2),
  },

  ingestion: {
    resumeSkillPoolSize: num('RESUME_SKILL_POOL_SIZE', 15),
    genericQueries: list('INGESTION_QUERIES', [
      'software engineer', 'data analyst', 'product manager', 'accountant',
      'sales executive', 'customer support', 'graphic designer',
      'marketing manager', 'devops engineer', 'hr executive',
    ]),
    jobStaleDays: num('JOB_STALE_DAYS', 21),
    // If the pool hasn't been touched by ingestion in this many minutes,
    // trigger a rotating ingestion run right when the server boots, instead
    // of waiting for the next cron tick. This is what keeps "pool last
    // updated" from going stale during local dev, where the server often
    // isn't left running long enough for JOB_INGESTION_CRON to ever fire.
    startupRefreshStaleMinutes: num('STARTUP_REFRESH_STALE_MINUTES', 30),
  },

  cron: {
    jobIngestion: process.env.JOB_INGESTION_CRON || '*/30 * * * *',
    delayedMatch: process.env.DELAYED_MATCH_CRON || '0 * * * *',
    dailyDigest: process.env.DAILY_DIGEST_CRON || '0 7 * * *',
    loginDigestSweep: process.env.LOGIN_DIGEST_SWEEP_CRON || '*/15 * * * *',
  },

  loginDigest: {
    delayMinutes: num('LOGIN_DIGEST_DELAY_MINUTES', 120),
    dedupeHours: num('LOGIN_DIGEST_DEDUPE_HOURS', 20),
    minScore: num('LOGIN_DIGEST_MIN_SCORE', 70),
  },

  frontendOrigin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
};
