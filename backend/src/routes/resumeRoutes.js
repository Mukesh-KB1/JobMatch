import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { loadOwned } from '../middleware/ownership.js';
import { uploadResume } from '../config/upload.js';
import { resumeService } from '../services/resumeService.js';
import { resumeRepository } from '../repositories/resumeRepository.js';

const router = Router();
function asyncHandler(fn) {
  return (req, res, next) => fn(req, res, next).catch(next);
}

router.use(requireAuth);

router.post(
  '/',
  uploadResume.single('resume'),
  asyncHandler(async (req, res) => {
    const resume = await resumeService.uploadAndParse(req.user.id, req.file);
    res.status(201).json({ resume });
  })
);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const resumes = await resumeService.listForUser(req.user.id);
    res.json({ resumes });
  })
);

// Ownership-enforced: 404 (not 403) if this resume doesn't belong to req.user.
router.get('/:id', loadOwned(resumeRepository.findByIdForUser, 'resumeDoc'), (req, res) => {
  res.json({ resume: req.resumeDoc });
});

// Lets a user with multiple resumes choose which one is used for matching.
router.patch(
  '/:id/activate',
  loadOwned(resumeRepository.findByIdForUser, 'resumeDoc'),
  asyncHandler(async (req, res) => {
    const resume = await resumeService.setActive(req.resumeDoc._id, req.user.id);
    res.json({ resume });
  })
);

router.delete('/:id', loadOwned(resumeRepository.findByIdForUser, 'resumeDoc'), asyncHandler(async (req, res) => {
  await resumeService.deleteForUser(req.resumeDoc._id, req.user.id);
  res.status(200).json({ deleted: true });
}));

export default router;