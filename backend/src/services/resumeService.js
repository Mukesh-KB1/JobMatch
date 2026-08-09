import fs from 'fs/promises';
import pdfParse from 'pdf-parse';
import mammoth from 'mammoth';
import { resumeRepository } from '../repositories/resumeRepository.js';
import { extractSkills, extractExperienceYears } from '../utils/skillsDictionary.js';
import { HttpError } from '../middleware/errorHandler.js';

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
]);
const MAX_BYTES = 5 * 1024 * 1024; // 5MB cap
const MAX_RESUMES_PER_USER = 5;

async function extractText(filePath, mimeType) {
  if (mimeType === 'application/pdf') {
    const buffer = await fs.readFile(filePath);
    const result = await pdfParse(buffer);
    return result.text;
  }
  // .docx
  const result = await mammoth.extractRawText({ path: filePath });
  return result.value;
}

export const resumeService = {
  // Validated by MIME type and size, not filename extension alone.
  validateUpload(file) {
    if (!file) {
      throw new HttpError(400, 'No file was uploaded.');
    }
    if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new HttpError(400, 'Only PDF and DOCX resumes are accepted.');
    }
    if (file.size > MAX_BYTES) {
      throw new HttpError(400, 'Resume must be 5MB or smaller.');
    }
  },

  async uploadAndParse(userId, file) {
    this.validateUpload(file);

    const existingCount = await resumeRepository.countForUser(userId);
    if (existingCount >= MAX_RESUMES_PER_USER) {
      throw new HttpError(
        400,
        `You can keep up to ${MAX_RESUMES_PER_USER} resumes. Delete one before uploading another.`
      );
    }

    const resume = await resumeRepository.createAsActive({
      userId,
      originalFilename: file.originalname,
      mimeType: file.mimetype,
      storagePath: file.path,
      parseStatus: 'pending',
      isActive: true,
    });

    try {
      const text = await extractText(file.path, file.mimetype);
      const skills = extractSkills(text);
      const experienceYears = extractExperienceYears(text);
      const updated = await resumeRepository.updateForUser(resume._id, userId, {
        parsedText: text,
        skills,
        experienceYears,
        parseStatus: 'parsed',
        parseError: null,
      });
      return updated;
    } catch (err) {
      return resumeRepository.updateForUser(resume._id, userId, {
        parseStatus: 'failed',
        parseError: err.message,
      });
    }
  },

  listForUser(userId) {
    return resumeRepository.listForUser(userId);
  },

  getForUser(id, userId) {
    return resumeRepository.findByIdForUser(id, userId);
  },

  // Explicit "use this resume for matching" - lets a user with several
  // resumes (e.g. one MERN-stack-focused, one more backend-only) choose
  // which one drives their scores and job ranking, instead of it silently
  // always being whichever was uploaded most recently.
  async setActive(id, userId) {
    const updated = await resumeRepository.setActiveForUser(id, userId);
    if (!updated) {
      throw new HttpError(404, 'Not found.');
    }
    return updated;
  },

  // Deletes a resume, and if it happened to be the active one, automatically
  // promotes the next-most-recent remaining resume to active - so a user
  // never ends up with zero active resume (and therefore no matching/
  // ranking) just because they deleted one without thinking to pick a new
  // active one first.
  async deleteForUser(id, userId) {
    const deleted = await resumeRepository.deleteForUser(id, userId);
    if (!deleted) {
      throw new HttpError(404, 'Not found.');
    }
    if (deleted.isActive) {
      const remaining = await resumeRepository.listForUser(userId);
      if (remaining.length > 0) {
        await resumeRepository.setActiveForUser(remaining[0]._id, userId);
      }
    }
    return deleted;
  },
};