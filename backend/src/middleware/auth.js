import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import User from '../models/User.js';

// req.user.id (from the verified JWT) is the ONLY source of truth for "who
// is asking". No route ever trusts a userId supplied in params or body for
// authorization decisions - that value is only ever used for *what* to fetch
// on behalf of the authenticated caller, never *whether* they're allowed to.
export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required.' });
  }
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    req.user = { id: payload.sub };
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
}

// Gate for anything beyond browsing: resumes, AI scoring, and applications
// all require a verified email. Must run after requireAuth (needs req.user).
// Job *listing* deliberately does NOT use this - unverified users can still
// browse jobs, they just can't act on them yet.
export async function requireVerified(req, res, next) {
  try {
    const user = await User.findById(req.user.id).select('emailVerified');
    if (!user) {
      return res.status(401).json({ error: 'Invalid or expired token.' });
    }
    if (!user.emailVerified) {
      return res.status(403).json({ error: 'Please verify your email to use this feature.', code: 'EMAIL_NOT_VERIFIED' });
    }
    next();
  } catch (err) {
    next(err);
  }
}

export function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}