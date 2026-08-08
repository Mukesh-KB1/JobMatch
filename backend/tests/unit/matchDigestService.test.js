import { jest } from '@jest/globals';

const mockSendMatchDigest = jest.fn().mockResolvedValue({});
jest.unstable_mockModule('../../src/services/emailService.js', () => ({
  emailService: {
    sendVerificationEmail: jest.fn().mockResolvedValue({}),
    sendPasswordResetEmail: jest.fn().mockResolvedValue({}),
    sendMatchDigest: mockSendMatchDigest,
  },
}));

const { matchDigestService } = await import('../../src/services/matchDigestService.js');
const { userRepository } = await import('../../src/repositories/userRepository.js');
const { createUser, createResume, createJob, createMatch } = await import('../helpers.js');
const Match = (await import('../../src/models/Match.js')).default;

describe('matchDigestService.runDailyDigest', () => {
  beforeEach(() => mockSendMatchDigest.mockClear());

  test('emails only unsent matches scoring >= 70, and marks them included after send', async () => {
    const user = await createUser({ emailVerified: true, digestOptIn: true });
    const resume = await createResume(user._id);
    const highJob = await createJob();
    const lowJob = await createJob();
    const alreadySentJob = await createJob();

    const highMatch = await createMatch(user._id, highJob._id, resume._id, { score: 85 });
    await createMatch(user._id, lowJob._id, resume._id, { score: 40 });
    await createMatch(user._id, alreadySentJob._id, resume._id, { score: 95, includedInDigestAt: new Date() });

    await matchDigestService.runDailyDigest({ minScore: 70, limit: 10 });

    expect(mockSendMatchDigest).toHaveBeenCalledTimes(1);
    const [, sentMatches] = mockSendMatchDigest.mock.calls[0];
    const sentJobIds = sentMatches.map((m) => String(m.jobId._id || m.jobId));
    expect(sentJobIds).toContain(String(highJob._id));
    expect(sentJobIds).not.toContain(String(lowJob._id));
    expect(sentJobIds).not.toContain(String(alreadySentJob._id));

    const updated = await Match.findById(highMatch._id);
    expect(updated.includedInDigestAt).not.toBeNull();
  });

  test('opted-out users are skipped entirely', async () => {
    const user = await createUser({ emailVerified: true, digestOptIn: false });
    const resume = await createResume(user._id);
    const job = await createJob();
    await createMatch(user._id, job._id, resume._id, { score: 90 });

    await matchDigestService.runDailyDigest({ minScore: 70, limit: 10 });
    expect(mockSendMatchDigest).not.toHaveBeenCalled();
  });

  test('unverified users are skipped entirely', async () => {
    const user = await createUser({ emailVerified: false, digestOptIn: true });
    const resume = await createResume(user._id);
    const job = await createJob();
    await createMatch(user._id, job._id, resume._id, { score: 90 });

    await matchDigestService.runDailyDigest({ minScore: 70, limit: 10 });
    expect(mockSendMatchDigest).not.toHaveBeenCalled();
  });
});

describe('matchDigestService.queueLoginDigest (dedupe)', () => {
  test('queues a digest for an eligible user with nothing pending', async () => {
    const user = await createUser({ emailVerified: true, digestOptIn: true });
    const result = await matchDigestService.queueLoginDigest(user);
    expect(result.queued).toBe(true);

    const updated = await userRepository.findById(user._id);
    expect(updated.pendingLoginDigestAt).not.toBeNull();
  });

  test('does not requeue if one is already pending', async () => {
    const pendingAt = new Date(Date.now() + 60 * 60 * 1000);
    const user = await createUser({ emailVerified: true, digestOptIn: true, pendingLoginDigestAt: pendingAt });

    const result = await matchDigestService.queueLoginDigest(user);
    expect(result.queued).toBe(false);
    expect(result.reason).toBe('already_queued');

    const updated = await userRepository.findById(user._id);
    expect(updated.pendingLoginDigestAt.getTime()).toBe(pendingAt.getTime());
  });

  test('does not requeue if one was sent within the dedupe window', async () => {
    const recentlySent = new Date(Date.now() - 2 * 60 * 60 * 1000); // 2h ago, default window is 20h
    const user = await createUser({ emailVerified: true, digestOptIn: true, lastLoginDigestSentAt: recentlySent });

    const result = await matchDigestService.queueLoginDigest(user);
    expect(result.queued).toBe(false);
    expect(result.reason).toBe('recently_sent');
  });

  test('queues again once the dedupe window has passed', async () => {
    const longAgo = new Date(Date.now() - 25 * 60 * 60 * 1000); // 25h ago, past default 20h window
    const user = await createUser({ emailVerified: true, digestOptIn: true, lastLoginDigestSentAt: longAgo });

    const result = await matchDigestService.queueLoginDigest(user);
    expect(result.queued).toBe(true);
  });

  test('skips ineligible users (unverified or opted out)', async () => {
    const unverified = await createUser({ emailVerified: false, digestOptIn: true });
    const optedOut = await createUser({ emailVerified: true, digestOptIn: false });

    expect((await matchDigestService.queueLoginDigest(unverified)).queued).toBe(false);
    expect((await matchDigestService.queueLoginDigest(optedOut)).queued).toBe(false);
  });
});
