import mongoose from 'mongoose';
import Application from '../models/Application.js';

export const applicationRepository = {
  // Upsert on userId+jobId - double-clicking Apply is a no-op, not an error.
  upsert({ userId, jobId, matchScore }) {
    return Application.findOneAndUpdate(
      { userId, jobId },
      { $setOnInsert: { userId, jobId, matchScore, status: 'applied', appliedAt: new Date() } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  },
  listForUser(userId) {
    return Application.find({ userId }).sort({ appliedAt: -1 }).populate('jobId');
  },
  // Lightweight lookup used to mark which jobs in a listing the user has
  // already applied to, without pulling the full application/job documents.
  listJobIdsForUser(userId, jobIds) {
    return Application.find({ userId, jobId: { $in: jobIds } }).select('jobId').lean();
  },
  findByIdForUser(id, userId) {
    if (!mongoose.isValidObjectId(id)) return null;
    return Application.findOne({ _id: id, userId });
  },
};