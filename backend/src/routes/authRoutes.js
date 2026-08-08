import { Router } from 'express';
import { authService } from '../services/authService.js';
import { authRateLimiter } from '../middleware/rateLimit.js';
import { requireAuth } from '../middleware/auth.js';
import { userRepository } from '../repositories/userRepository.js';
import { HttpError } from '../middleware/errorHandler.js';

const router = Router();

function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

router.post(
  '/register',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const { email, password, name } = req.body || {};
    if (!email || !password || !name) {
      throw new HttpError(400, 'Email, password, and name are required.');
    }
    if (String(password).length < 8) {
      throw new HttpError(400, 'Password must be at least 8 characters.');
    }
    const result = await authService.register({ email, password, name });
    res.status(201).json(result);
  })
);

router.post(
  '/login',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) {
      throw new HttpError(400, 'Email and password are required.');
    }
    const result = await authService.login({ email, password });
    res.json(result);
  })
);

router.post(
  '/google',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const { idToken } = req.body || {};
    if (!idToken) {
      throw new HttpError(400, 'idToken is required.');
    }
    const result = await authService.googleLogin({ idToken });
    res.json(result);
  })
);

router.post(
  '/verify-email',
  asyncHandler(async (req, res) => {
    const { token } = req.body || {};
    if (!token) throw new HttpError(400, 'token is required.');
    const result = await authService.verifyEmail({ rawToken: token });
    res.json(result);
  })
);

router.post(
  '/request-password-reset',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const { email } = req.body || {};
    if (!email) throw new HttpError(400, 'email is required.');
    const result = await authService.requestPasswordReset({ email });
    res.json(result);
  })
);

router.post(
  '/reset-password',
  authRateLimiter,
  asyncHandler(async (req, res) => {
    const { token, newPassword } = req.body || {};
    if (!token || !newPassword) throw new HttpError(400, 'token and newPassword are required.');
    if (String(newPassword).length < 8) throw new HttpError(400, 'Password must be at least 8 characters.');
    const result = await authService.resetPassword({ rawToken: token, newPassword });
    res.json(result);
  })
);

router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const user = await userRepository.findById(req.user.id);
    if (!user) throw new HttpError(404, 'Not found.');
    res.json({ user: authService.toPublicUser(user) });
  })
);

export default router;
