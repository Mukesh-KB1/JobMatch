import User from '../models/User.js';

export const userRepository = {
  create(data) {
    return User.create(data);
  },
  findByEmail(email) {
    return User.findOne({ email: email.toLowerCase().trim() });
  },
  findById(id) {
    return User.findById(id);
  },
  findByGoogleId(googleId) {
    return User.findOne({ googleId });
  },
  findByEmailVerificationHash(hash) {
    return User.findOne({
      emailVerificationTokenHash: hash,
      emailVerificationExpires: { $gt: new Date() },
    });
  },
  findByResetPasswordHash(hash) {
    return User.findOne({
      resetPasswordTokenHash: hash,
      resetPasswordExpires: { $gt: new Date() },
    });
  },
  updateById(id, update) {
    return User.findByIdAndUpdate(id, update, { new: true });
  },
  // All users - used by the background match-scoring cron, which should run
  // regardless of email digest opt-in (opt-in only gates emailing, not scoring).
  findAll() {
    return User.find({});
  },
  // All users - used by the background match-scoring cron, which should run
  // regardless of email digest opt-in (opt-in only gates emailing, not scoring).
  findAll() {
    return User.find({});
  },
  // Users eligible for the daily digest: verified + opted in.
  findDigestEligible() {
    return User.find({ emailVerified: true, digestOptIn: true });
  },
  // Users whose queued login-digest time has arrived.
  findDueForLoginDigest(now = new Date()) {
    return User.find({
      emailVerified: true,
      digestOptIn: true,
      pendingLoginDigestAt: { $ne: null, $lte: now },
    });
  },
};
