import { jobRepository } from '../repositories/jobRepository.js';
import { matchService } from './matchService.js';

export const jobService = {
  // All user-facing reads query MongoDB only - zero external API calls
  // happen when a user loads the Jobs page.
  async listForUser(userId, { page = 1, pageSize = 20, country = '', search = '' } = {}) {
    const skip = (page - 1) * pageSize;
    return matchService.listJobsWithScores(userId, { skip, limit: pageSize, country, search });
  },

  // Freshness must be visible, not implied.
  async freshness() {
    const [count, mostRecent] = await Promise.all([
      jobRepository.countActive(),
      jobRepository.mostRecentlyUpdated(),
    ]);
    return {
      activeCount: count,
      lastUpdatedAt: mostRecent ? mostRecent.updatedAt : null,
    };
  },

  // Distinct countries present in the active job pool, for the country filter.
  async countries() {
    return jobRepository.listActiveCountries();
  },
};