import mongoose from 'mongoose';

const resumeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    originalFilename: { type: String, required: true },
    mimeType: { type: String, required: true },
    storagePath: { type: String, required: true },

    parsedText: { type: String, default: '' },
    skills: { type: [String], default: [] },
    experienceYears: { type: Number, default: null },

    parseStatus: { type: String, enum: ['pending', 'parsed', 'failed'], default: 'pending' },
    parseError: { type: String, default: null },

    // Only the most recently uploaded resume for a user is active; used for matching.
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

resumeSchema.index({ userId: 1, isActive: 1 });

export default mongoose.model('Resume', resumeSchema);
