import mongoose from 'mongoose';

const applicationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    matchScore: { type: Number, default: null },
    status: { type: String, enum: ['applied'], default: 'applied' },
    appliedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Clicking "Apply" twice is a no-op, not a duplicate record.
applicationSchema.index({ userId: 1, jobId: 1 }, { unique: true });

export default mongoose.model('Application', applicationSchema);
