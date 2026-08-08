import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { loadOwned } from '../middleware/ownership.js';
import { applicationService } from '../services/applicationService.js';
import { applicationRepository } from '../repositories/applicationRepository.js';
import { HttpError } from '../middleware/errorHandler.js';

const router = Router();
function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const applications = await applicationService.listForUser(req.user.id);
    res.json({ applications });
  })
);

router.post(
  '/jobs/:jobId',
  asyncHandler(async (req, res) => {
    const result = await applicationService.apply(req.user.id, req.params.jobId);
    res.status(201).json(result);
  })
);

router.get('/:id', loadOwned(applicationRepository.findByIdForUser, 'application'), (req, res) => {
  res.json({ application: req.application });
});

export default router;
