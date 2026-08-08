import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { jobService } from '../services/jobService.js';
import { jobRepository } from '../repositories/jobRepository.js';
import { HttpError } from '../middleware/errorHandler.js';

const router = Router();
function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

// Freshness and countries must come before /:id so they aren't swallowed by
// the id route.
router.get(
  '/meta/freshness',
  asyncHandler(async (req, res) => {
    const meta = await jobService.freshness();
    res.json(meta);
  })
);

router.get(
  '/meta/countries',
  asyncHandler(async (req, res) => {
    const countries = await jobService.countries();
    res.json({ countries });
  })
);

router.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(50, Math.max(1, parseInt(req.query.pageSize, 10) || 20));
    const country = typeof req.query.country === 'string' ? req.query.country.trim().toLowerCase() : '';
    const search = typeof req.query.search === 'string' ? req.query.search.trim().slice(0, 100) : '';
    const results = await jobService.listForUser(req.user.id, { page, pageSize, country, search });
    res.json({ results, page, pageSize, country, search });
  })
);

// Jobs are a shared pool, not user-owned - any active job is publicly
// readable by an authenticated user (no ownership check needed here, this
// isn't a user-owned resource per section 3).
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const job = await jobRepository.findByIdActive(req.params.id);
    if (!job) throw new HttpError(404, 'Not found.');
    res.json({ job });
  })
);

export default router;