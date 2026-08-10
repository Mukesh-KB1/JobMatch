import mongoose from 'mongoose';
import Resume from '../models/Resume.js';

// IDOR prevention is structural: every lookup of a specific resume takes the
// userId as a required filter argument baked into the Mongo query itself,
// never fetch-then-compare. See middleware/ownership.js for the generic
// wrapper used by routes, and tests/integration/ownership.test.js for proof.
export const resumeRepository = {
  create(data) {
    return Resume.create(data);
  },
  findByIdForUser(id, userId) {
    if (!mongoose.isValidObjectId(id)) return null;
    return Resume.findOne({ _id: id, userId });
  },
  listForUser(userId) {
    return Resume.find({ userId }).sort({ createdAt: -1 });
  },
  countForUser(userId) {
    return Resume.countDocuments({ userId });
  },
  findActiveForUser(userId) {
    return Resume.findOne({ userId, isActive: true, parseStatus: 'parsed' }).sort({ createdAt: -1 });
  },
  // Deactivates every prior resume, then inserts the new one. Previously
  // wrapped in a multi-document transaction for atomicity, but Atlas M0
  // (free tier) transactions can hang for up to ~2 minutes retrying
  // transient errors before failing - which surfaced to users as the app
  // "freezing" on any add/switch/delete. Plain sequential writes trade a
  // theoretical (and here harmless) moment of "two active resumes" for
  // requests that actually complete quickly and reliably. If the second
  // write fails, findActiveForUser's `.sort({createdAt:-1})` still makes
  // the newest one win, so there's no broken state to clean up.
  async createAsActive(data) {
    await Resume.updateMany({ userId: data.userId, isActive: true }, { $set: { isActive: false } });
    return Resume.create(data);
  },
  updateForUser(id, userId, update) {
    return Resume.findOneAndUpdate({ _id: id, userId }, update, { new: true });
  },
  // Makes exactly one resume active for a user: flips the target on first
  // (also verifying ownership - returns null if it doesn't exist or
  // belongs to someone else) so a not-found/not-owned id can never end up
  // deactivating every other resume before failing. See createAsActive's
  // comment above for why this isn't wrapped in a transaction.
  async setActiveForUser(id, userId) {
    if (!mongoose.isValidObjectId(id)) return null;
    const target = await Resume.findOneAndUpdate(
      { _id: id, userId },
      { $set: { isActive: true } },
      { new: true }
    );
    if (!target) return null;
    await Resume.updateMany(
      { userId, isActive: true, _id: { $ne: target._id } },
      { $set: { isActive: false } }
    );
    return target;
  },
  deleteForUser(id, userId) {
    return Resume.findOneAndDelete({ _id: id, userId });
  },
  // Used by the ingestion service to build resume-driven search queries
  // across ALL users - intentionally not scoped to one user.
  aggregateTopSkills(limit) {
    return Resume.aggregate([
      { $match: { isActive: true, parseStatus: 'parsed' } },
      { $unwind: '$skills' },
      { $group: { _id: '$skills', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: limit },
    ]);
  },
};