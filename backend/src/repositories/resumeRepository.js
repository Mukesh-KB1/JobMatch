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
  // Deactivates every prior resume and inserts the new one atomically, so a
  // user is never left with two "active" resumes if the process dies mid-way.
  async createAsActive(data) {
    const session = await mongoose.startSession();
    try {
      let created;
      await session.withTransaction(async () => {
        await Resume.updateMany(
          { userId: data.userId, isActive: true },
          { $set: { isActive: false } },
          { session }
        );
        const docs = await Resume.create([data], { session });
        created = docs[0];
      }, {
        writeConcern: { w: 'majority', wtimeout: 8000 },
      });
      return created;
    } finally {
      session.endSession();
    }
  },
  updateForUser(id, userId, update) {
    return Resume.findOneAndUpdate({ _id: id, userId }, update, { new: true });
  },
  // Atomically makes exactly one resume active for a user: first flips the
  // target on (also verifying ownership - returns null if it doesn't exist
  // or belongs to someone else), then flips every OTHER resume off in the
  // same transaction. Ordered this way (target first) so a not-found/
  // not-owned id can never end up deactivating every other resume before
  // failing.
  async setActiveForUser(id, userId) {
    if (!mongoose.isValidObjectId(id)) return null;
    const session = await mongoose.startSession();
    try {
      let result = null;
      await session.withTransaction(async () => {
        const target = await Resume.findOneAndUpdate(
          { _id: id, userId },
          { $set: { isActive: true } },
          { new: true, session }
        );
        if (!target) return;
        await Resume.updateMany(
          { userId, isActive: true, _id: { $ne: target._id } },
          { $set: { isActive: false } },
          { session }
        );
        result = target;
      }, {
        writeConcern: { w: 'majority', wtimeout: 8000 },
      });
      return result;
    } finally {
      session.endSession();
    }
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