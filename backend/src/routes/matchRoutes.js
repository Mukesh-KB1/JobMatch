import { Router } from 'express';
import { requireAuth, requireVerified } from '../middleware/auth.js';
import { loadOwned } from '../middleware/ownership.js';
import { matchService } from '../services/matchService.js';
import { matchRepository } from '../repositories/matchRepository.js';
import { HttpError } from '../middleware/errorHandler.js';

const router = Router();
function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

router.use(requireAuth);
router.use(requireVerified);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const matches = await matchService.listForUser(req.user.id);
    res.json({ matches });
  })
);

// "Score my fit" - immediate, on-demand scoring for a single job.
router.post(
  '/jobs/:jobId',
  asyncHandler(async (req, res) => {
    const match = await matchService.scoreJobForUser(req.user.id, req.params.jobId);
    res.status(201).json({ match });
  })
);

router.get('/:id', loadOwned(matchRepository.findByIdForUser, 'match'), (req, res) => {
  res.json({ match: req.match });
});

export default router;