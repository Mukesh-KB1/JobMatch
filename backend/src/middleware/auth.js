import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';

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

export function signToken(userId) {
  return jwt.sign({ sub: String(userId) }, config.jwtSecret, { expiresIn: config.jwtExpiresIn });
}
