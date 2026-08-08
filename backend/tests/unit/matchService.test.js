import { jest } from '@jest/globals';

const mockScore = jest.fn();
jest.unstable_mockModule('../../src/services/geminiClient.js', () => ({
  scoreResumeAgainstJob: mockScore,
}));

const { matchService } = await import('../../src/services/matchService.js');
const Match = (await import('../../src/models/Match.js')).default;
const { createUser, createResume, createJob } = await import('../helpers.js');

describe('matchService.scoreJobForUser', () => {
  beforeEach(() => mockScore.mockReset());

  test('clamps an out-of-range score from the AI into 0-100', async () => {
    mockScore.mockResolvedValueOnce({ score: 500, summary: 's', strengths: [], gaps: [] });
    const user = await createUser();
    await createResume(user._id);
    const job = await createJob();

    const match = await matchService.scoreJobForUser(user._id, job._id);
    expect(match.score).toBeLessThanOrEqual(100);
  });

  test('re-scoring the same job upserts instead of creating a duplicate', async () => {
    mockScore.mockResolvedValue({ score: 60, summary: 'first', strengths: [], gaps: [] });
    const user = await createUser();
    await createResume(user._id);
    const job = await createJob();

    await matchService.scoreJobForUser(user._id, job._id);

    mockScore.mockResolvedValueOnce({ score: 90, summary: 'second', strengths: [], gaps: [] });
    await matchService.scoreJobForUser(user._id, job._id);

    const count = await Match.countDocuments({ userId: user._id, jobId: job._id });
    expect(count).toBe(1);
    const match = await Match.findOne({ userId: user._id, jobId: job._id });
    expect(match.score).toBe(90);
    expect(match.summary).toBe('second');
  });

  test('throws a clear error when the user has no active parsed resume', async () => {
    const user = await createUser();
    const job = await createJob();
    await expect(matchService.scoreJobForUser(user._id, job._id)).rejects.toThrow(/resume/i);
  });

  test('throws 404 for a job that does not exist / is not active', async () => {
    const user = await createUser();
    await createResume(user._id);
    await expect(
      matchService.scoreJobForUser(user._id, '64b64b64b64b64b64b64b64b')
    ).rejects.toMatchObject({ status: 404 });
  });
});
