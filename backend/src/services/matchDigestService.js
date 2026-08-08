import { config } from '../config/env.js';
import { userRepository } from '../repositories/userRepository.js';
import { matchRepository } from '../repositories/matchRepository.js';
import { digestLogRepository } from '../repositories/digestLogRepository.js';
import { emailService } from './emailService.js';

// Sends up to `limit` unsent matches scoring >= minScore to `user`, marks
// them included, and writes a DigestLog row. Shared by both the daily and
// login-triggered mechanisms so whichever fires first "claims" a match via
// the shared includedInDigestAt flag - the other will simply find nothing
// left to send for it.
async function sendDigestForUser(user, { minScore, limit }) {
  const matches = await matchRepository.findDigestEligibleForUser(user._id, minScore, limit);
  if (matches.length === 0) {
    await digestLogRepository.create({ userId: user._id, status: 'skipped_no_matches', matchIds: [] });
    return { status: 'skipped_no_matches', count: 0 };
  }
  try {
    await emailService.sendMatchDigest(user, matches);
    const matchIds = matches.map((m) => m._id);
    await matchRepository.markIncludedInDigest(matchIds);
    await digestLogRepository.create({ userId: user._id, status: 'sent', matchIds });
    return { status: 'sent', count: matches.length };
  } catch (err) {
    await digestLogRepository.create({
      userId: user._id,
      status: 'failed',
      matchIds: [],
      error: err.message,
    });
    return { status: 'failed', count: 0, error: err.message };
  }
}

export const matchDigestService = {
  // Fixed daily schedule (default 7am). Every opted-in, verified user with
  // unsent matches scoring >= 70 gets emailed up to 10 of them.
  async runDailyDigest({ minScore = config.loginDigest.minScore, limit = 10 } = {}) {
    const users = await userRepository.findDigestEligible();
    const results = [];
    for (const user of users) {
      results.push(await sendDigestForUser(user, { minScore, limit }));
    }
    return results;
  },

  // Called after every successful login / completed password reset. Queues a
  // one-time "best matches" email ~2 hours later, with dedupe:
  //  - skip if unverified or opted out
  //  - skip if one is already queued (don't reschedule on repeated logins)
  //  - skip if one was sent within LOGIN_DIGEST_DEDUPE_HOURS
  async queueLoginDigest(user) {
    if (!user.emailVerified || !user.digestOptIn) return { queued: false, reason: 'ineligible' };
    if (user.pendingLoginDigestAt) return { queued: false, reason: 'already_queued' };

    if (user.lastLoginDigestSentAt) {
      const hoursSinceSent = (Date.now() - user.lastLoginDigestSentAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceSent < config.loginDigest.dedupeHours) {
        return { queued: false, reason: 'recently_sent' };
      }
    }

    const sendAt = new Date(Date.now() + config.loginDigest.delayMinutes * 60 * 1000);
    await userRepository.updateById(user._id, { pendingLoginDigestAt: sendAt });
    return { queued: true, sendAt };
  },

  // Sweep cron (every 15 min): sends to users whose queued time has arrived,
  // then clears the queue flag regardless of outcome so it never gets stuck.
  async runLoginDigestSweep({ minScore = config.loginDigest.minScore, limit = 10 } = {}) {
    const due = await userRepository.findDueForLoginDigest(new Date());
    const results = [];
    for (const user of due) {
      const result = await sendDigestForUser(user, { minScore, limit });
      await userRepository.updateById(user._id, {
        pendingLoginDigestAt: null,
        lastLoginDigestSentAt: new Date(),
      });
      results.push({ userId: user._id, ...result });
    }
    return results;
  },
};
