import multer from 'multer';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.resolve('uploads', 'resumes');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${unique}${path.extname(file.originalname)}`);
  },
});

// Size cap enforced here too (belt-and-suspenders with resumeService's check),
// MIME validation is done in resumeService since multer's fileFilter only
// sees the client-reported mimetype, same as the service-layer check.
export const uploadResume = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
});
