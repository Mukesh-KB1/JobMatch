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
