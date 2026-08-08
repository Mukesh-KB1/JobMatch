import mongoose from 'mongoose';
import Match from '../models/Match.js';

export const matchRepository = {
  // Re-scoring upserts, never duplicates (unique index on userId+jobId).
  upsert({ userId, jobId, resumeId, score, summary, strengths, gaps, matchedVia }) {
    return Match.findOneAndUpdate(
      { userId, jobId },
      {
        $set: { resumeId, score, summary, strengths, gaps, matchedVia },
        $setOnInsert: { includedInDigestAt: null },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  },
  findByIdForUser(id, userId) {
    if (!mongoose.isValidObjectId(id)) return null;
    return Match.findOne({ _id: id, userId });
  },
  listForUser(userId) {
    return Match.find({ userId }).sort({ score: -1 });
  },
  // Used by the Jobs page to merge already-computed scores into the listing.
  findManyForUserByJobIds(userId, jobIds) {
    return Match.find({ userId, jobId: { $in: jobIds } });
  },
  findOneForUserAndJob(userId, jobId) {
    return Match.findOne({ userId, jobId });
  },
  // Matches eligible for a digest: score >= threshold, not yet included.
  findDigestEligibleForUser(userId, minScore, limit) {
    return Match.find({ userId, score: { $gte: minScore }, includedInDigestAt: null })
      .sort({ score: -1 })
      .limit(limit)
      .populate('jobId');
  },
  markIncludedInDigest(matchIds, when = new Date()) {
    return Match.updateMany({ _id: { $in: matchIds } }, { $set: { includedInDigestAt: when } });
  },
};
