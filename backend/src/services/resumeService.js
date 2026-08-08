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
};
