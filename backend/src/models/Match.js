import mongoose from 'mongoose';

const matchSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true, index: true },
    resumeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resume', required: true },

    score: { type: Number, required: true, min: 0, max: 100 },
    summary: { type: String, default: '' },
    strengths: { type: [String], default: [] },
    gaps: { type: [String], default: [] },

    matchedVia: { type: String, enum: ['immediate', 'delayed_cron'], required: true },

    // Null until an email (daily or login-triggered digest) has included this
    // match. Shared flag so whichever digest mechanism fires first "claims" it.
    includedInDigestAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Re-matching upserts, never duplicates.
matchSchema.index({ userId: 1, jobId: 1 }, { unique: true });
matchSchema.index({ userId: 1, score: -1 });
matchSchema.index({ userId: 1, includedInDigestAt: 1, score: -1 });

export default mongoose.model('Match', matchSchema);
