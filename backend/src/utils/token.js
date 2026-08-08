import crypto from 'crypto';

// Password reset / email verification tokens are stored only as SHA-256
// hashes. The raw token exists only in the emailed link - if the DB leaks,
// the tokens in it are useless.
export function generateRawToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}
