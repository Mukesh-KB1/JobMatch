import mongoose from 'mongoose';

const userSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    // null for Google-only accounts - they never set a password
    passwordHash: { type: String, default: null },
    name: { type: String, required: true, trim: true },

    googleId: { type: String, default: null, index: true, sparse: true },
    authProvider: { type: String, enum: ['password', 'google'], required: true },
    avatarUrl: { type: String, default: null },

    emailVerified: { type: Boolean, default: false },
    // Only the SHA-256 hash is ever stored; the raw token lives only in the emailed link.
    emailVerificationTokenHash: { type: String, default: null },
    emailVerificationExpires: { type: Date, default: null },

    resetPasswordTokenHash: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },

    digestEmail: { type: String, default: null }, // defaults to `email` at creation time
    digestOptIn: { type: Boolean, default: true },

    // Login-triggered digest scheduling (see matchDigestService)
    pendingLoginDigestAt: { type: Date, default: null },
    lastLoginDigestSentAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export default mongoose.model('User', userSchema);
