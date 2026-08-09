import express from 'express';
import cors from 'cors';
import { config } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';

import authRoutes from './routes/authRoutes.js';
import resumeRoutes from './routes/resumeRoutes.js';
import jobRoutes from './routes/jobRoutes.js';
import matchRoutes from './routes/matchRoutes.js';
import applicationRoutes from './routes/applicationRoutes.js';

export function createApp() {
  const app = express();

  // Render (like most PaaS hosts) puts the app behind a reverse proxy, which
  // adds an X-Forwarded-For header to every request. Without telling Express
  // to trust that one hop, express-rate-limit sees a forwarded-for header it
  // wasn't authorized to trust and throws ERR_ERL_UNEXPECTED_X_FORWARDED_FOR
  // mid-request - the response never gets sent, and the request hangs
  // forever client-side. `1` = trust exactly one hop (the platform's own
  // proxy), which is correct for Render/Railway/Heroku-style single-proxy
  // setups - do not use `true` (trusts any proxy, spoofable) here.
  app.set('trust proxy', 1);

  app.use(cors({ origin: config.frontendOrigin, credentials: true }));
  app.use(express.json());

  app.get('/api/health', (req, res) => res.json({ ok: true }));

  app.use('/api/auth', authRoutes);
  app.use('/api/resumes', resumeRoutes);
  app.use('/api/jobs', jobRoutes);
  app.use('/api/matches', matchRoutes);
  app.use('/api/applications', applicationRoutes);

  app.use((req, res) => res.status(404).json({ error: 'Not found.' }));
  app.use(errorHandler);

  return app;
}