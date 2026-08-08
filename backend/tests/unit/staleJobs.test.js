import { deactivateStaleJobs } from '../../src/services/ingestionService.js';
import Job from '../../src/models/Job.js';
import { createJob } from '../helpers.js';

describe('deactivateStaleJobs', () => {
  test('deactivates a non-manual posting not reconfirmed within JOB_STALE_DAYS', async () => {
    const staleDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
    const staleJob = await createJob({ source: 'adzuna', lastConfirmedAt: staleDate });

    await deactivateStaleJobs();

    const updated = await Job.findById(staleJob._id);
    expect(updated.isActive).toBe(false);
  });

  test('leaves a recently-confirmed posting active', async () => {
    const freshJob = await createJob({ source: 'adzuna', lastConfirmedAt: new Date() });
    await deactivateStaleJobs();
    const updated = await Job.findById(freshJob._id);
    expect(updated.isActive).toBe(true);
  });

  test('never deactivates manual postings, no matter how old', async () => {
    const staleDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000);
    const manualJob = await createJob({ source: 'manual', lastConfirmedAt: staleDate });

    await deactivateStaleJobs();

    const updated = await Job.findById(manualJob._id);
    expect(updated.isActive).toBe(true);
  });

  test('deactivation never deletes the document, only flips isActive', async () => {
    const staleDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const staleJob = await createJob({ source: 'jooble', lastConfirmedAt: staleDate });
    await deactivateStaleJobs();
    const stillExists = await Job.findById(staleJob._id);
    expect(stillExists).not.toBeNull();
  });
});
