import { applicationRepository } from '../repositories/applicationRepository.js';
import { matchRepository } from '../repositories/matchRepository.js';
import { jobRepository } from '../repositories/jobRepository.js';
import { HttpError } from '../middleware/errorHandler.js';

export const applicationService = {
  async apply(userId, jobId) {
    const job = await jobRepository.findByIdActive(jobId);
    if (!job) {
      throw new HttpError(404, 'Not found.');
    }
    const match = await matchRepository.findOneForUserAndJob(userId, jobId);
    const application = await applicationRepository.upsert({
      userId,
      jobId,
      matchScore: match ? match.score : null,
    });
    return { application, applyUrl: job.applyUrl };
  },

  listForUser(userId) {
    return applicationRepository.listForUser(userId);
  },
};
