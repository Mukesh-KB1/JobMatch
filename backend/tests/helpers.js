import bcrypt from 'bcrypt';
import User from '../src/models/User.js';
import Resume from '../src/models/Resume.js';
import Job from '../src/models/Job.js';
import Match from '../src/models/Match.js';
import Application from '../src/models/Application.js';
import { signToken } from '../src/middleware/auth.js';

export async function createUser(overrides = {}) {
  const passwordHash = overrides.passwordHash !== undefined
    ? overrides.passwordHash
    : await bcrypt.hash('correct-horse-battery-staple', 4);
  const user = await User.create({
    email: overrides.email || `user-${Date.now()}-${Math.random()}@example.com`,
    passwordHash,
    name: overrides.name || 'Test User',
    authProvider: overrides.authProvider || 'password',
    emailVerified: overrides.emailVerified ?? true,
    digestOptIn: overrides.digestOptIn ?? true,
    digestEmail: overrides.digestEmail,
    ...overrides,
  });
  return user;
}

export function authHeader(user) {
  return { Authorization: `Bearer ${signToken(user._id)}` };
}

export async function createResume(userId, overrides = {}) {
  return Resume.create({
    userId,
    originalFilename: 'resume.pdf',
    mimeType: 'application/pdf',
    storagePath: '/tmp/fake.pdf',
    parsedText: 'Experienced React and Node.js developer with 5 years of experience.',
    skills: ['react', 'node.js', 'javascript'],
    experienceYears: 5,
    parseStatus: 'parsed',
    isActive: true,
    ...overrides,
  });
}

export async function createJob(overrides = {}) {
  return Job.create({
    title: 'Software Engineer',
    company: 'Acme',
    location: 'Remote',
    country: '',
    description: 'Build things with React and Node.js.',
    requiredSkills: ['react', 'node.js'],
    source: overrides.source || 'seed',
    externalId: overrides.externalId ?? `ext-${Date.now()}-${Math.random()}`,
    applyUrl: 'https://example.com/apply',
    isActive: true,
    ...overrides,
  });
}

export async function createMatch(userId, jobId, resumeId, overrides = {}) {
  return Match.create({
    userId,
    jobId,
    resumeId,
    score: 80,
    summary: 'Good fit.',
    strengths: ['react'],
    gaps: [],
    matchedVia: 'immediate',
    ...overrides,
  });
}

export async function createApplication(userId, jobId, overrides = {}) {
  return Application.create({
    userId,
    jobId,
    matchScore: 80,
    status: 'applied',
    ...overrides,
  });
}
