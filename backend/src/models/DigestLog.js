import mongoose from 'mongoose';

const digestLogSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    sentAt: { type: Date, default: Date.now },
    matchIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
    status: { type: String, enum: ['sent', 'failed', 'skipped_no_matches'], required: true },
    error: { type: String, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('DigestLog', digestLogSchema);
