import bcrypt from 'bcrypt';
import { OAuth2Client } from 'google-auth-library';
import { userRepository } from '../repositories/userRepository.js';
import { signToken } from '../middleware/auth.js';
import { generateRawToken, hashToken } from '../utils/token.js';
import { HttpError } from '../middleware/errorHandler.js';
import { config } from '../config/env.js';
import { emailService } from './emailService.js';
import { matchDigestService } from './matchDigestService.js';

const SALT_ROUNDS = 12;
const EMAIL_VERIFICATION_TTL_MS = 24 * 60 * 60 * 1000; // 24h
const RESET_PASSWORD_TTL_MS = 60 * 60 * 1000; // 1h

const googleClient = new OAuth2Client(config.googleClientId);

function toPublicUser(user) {
  return {
    id: user._id,
    email: user.email,
    name: user.name,
    authProvider: user.authProvider,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    digestOptIn: user.digestOptIn,
  };
}

async function afterSuccessfulLogin(user) {
  // Queue (or leave alone) the login-triggered "best matches" digest.
  await matchDigestService.queueLoginDigest(user);
  // Optional chaining keeps existing test/local email adapters compatible.
  await emailService.sendLoginNotificationEmail?.(user);
}

export const authService = {
  async register({ email, password, name }) {
    const existing = await userRepository.findByEmail(email);
    if (existing) {
      throw new HttpError(409, 'An account with that email already exists.');
    }
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const user = await userRepository.create({
      email,
      passwordHash,
      name,
      authProvider: 'password',
      digestEmail: email,
    });

    const rawToken = generateRawToken();
    await userRepository.updateById(user._id, {
      emailVerificationTokenHash: hashToken(rawToken),
      emailVerificationExpires: new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS),
    });
    await emailService.sendVerificationEmail(user, rawToken);

    const token = signToken(user._id);
    return { token, user: toPublicUser(user) };
  },

  async login({ email, password }) {
    const user = await userRepository.findByEmail(email);
    // Same generic failure for "no such user" and "wrong password" - don't
    // leak which one it was.
    if (!user || user.authProvider !== 'password' || !user.passwordHash) {
      throw new HttpError(401, 'Invalid email or password.');
    }
    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      throw new HttpError(401, 'Invalid email or password.');
    }
    await afterSuccessfulLogin(user);
    const token = signToken(user._id);
    return { token, user: toPublicUser(user) };
  },

  // Google ID tokens are verified server-side against Google's servers -
  // never trust a token's claims without re-verifying them.
  async googleLogin({ idToken }) {
    let payload;
    try {
      const ticket = await googleClient.verifyIdToken({
        idToken,
        audience: config.googleClientId,
      });
      payload = ticket.getPayload();
    } catch (err) {
      throw new HttpError(401, 'Invalid Google credential.');
    }
    if (!payload || !payload.email) {
      throw new HttpError(401, 'Invalid Google credential.');
    }

    let user = await userRepository.findByGoogleId(payload.sub);
    if (!user) {
      // Link to an existing password account matched by email, else create new.
      user = await userRepository.findByEmail(payload.email);
      if (user) {
        user = await userRepository.updateById(user._id, {
          googleId: payload.sub,
          avatarUrl: user.avatarUrl || payload.picture || null,
          emailVerified: true, // Google-verified emails are auto-marked verified
        });
      } else {
        user = await userRepository.create({
          email: payload.email,
          name: payload.name || payload.email,
          googleId: payload.sub,
          authProvider: 'google',
          avatarUrl: payload.picture || null,
          emailVerified: true,
          digestEmail: payload.email,
        });
      }
    }
    await afterSuccessfulLogin(user);
    const token = signToken(user._id);
    return { token, user: toPublicUser(user) };
  },

  async verifyEmail({ rawToken }) {
    const hash = hashToken(rawToken);
    const user = await userRepository.findByEmailVerificationHash(hash);
    if (!user) {
      throw new HttpError(400, 'That verification link is invalid or has expired.');
    }
    await userRepository.updateById(user._id, {
      emailVerified: true,
      emailVerificationTokenHash: null,
      emailVerificationExpires: null,
    });
    return { verified: true };
  },

  // Always responds identically whether or not the email exists - don't leak
  // account existence.
  async requestPasswordReset({ email }) {
    const user = await userRepository.findByEmail(email);
    if (user && user.authProvider === 'password') {
      const rawToken = generateRawToken();
      await userRepository.updateById(user._id, {
        resetPasswordTokenHash: hashToken(rawToken),
        resetPasswordExpires: new Date(Date.now() + RESET_PASSWORD_TTL_MS),
      });
      await emailService.sendPasswordResetEmail(user, rawToken);
    }
    return { message: 'If that email is registered, a reset link has been sent.' };
  },

  async resetPassword({ rawToken, newPassword }) {
    const hash = hashToken(rawToken);
    const user = await userRepository.findByResetPasswordHash(hash);
    if (!user) {
      throw new HttpError(400, 'That reset link is invalid or has expired.');
    }
    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    const updated = await userRepository.updateById(user._id, {
      passwordHash,
      resetPasswordTokenHash: null, // single-use
      resetPasswordExpires: null,
    });
    // Optional chaining keeps existing test/local email adapters compatible.
    await emailService.sendPasswordChangedEmail?.(updated);
    await afterSuccessfulLogin(updated);
    return { reset: true };
  },

  toPublicUser,
};
