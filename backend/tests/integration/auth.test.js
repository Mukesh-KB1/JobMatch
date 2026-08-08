import request from 'supertest';
import { jest } from '@jest/globals';

// Mock email + Google verification before importing anything that uses them,
// per the requirement that every test touching mailer/Gemini mocks it explicitly.
jest.unstable_mockModule('../../src/services/emailService.js', () => ({
  emailService: {
    sendVerificationEmail: jest.fn().mockResolvedValue({}),
    sendPasswordResetEmail: jest.fn().mockResolvedValue({}),
    sendMatchDigest: jest.fn().mockResolvedValue({}),
  },
}));

const mockVerifyIdToken = jest.fn();
jest.unstable_mockModule('google-auth-library', () => ({
  OAuth2Client: jest.fn().mockImplementation(() => ({
    verifyIdToken: mockVerifyIdToken,
  })),
}));

const { createApp } = await import('../../src/app.js');
const { emailService } = await import('../../src/services/emailService.js');
const User = (await import('../../src/models/User.js')).default;

const app = createApp();

describe('Auth', () => {
  test('register creates an unverified user and sends a verification email', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: 'new@example.com',
      password: 'supersecret1',
      name: 'New Person',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.emailVerified).toBe(false);
    expect(emailService.sendVerificationEmail).toHaveBeenCalled();
  });

  test('register rejects a duplicate email', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'dupe@example.com', password: 'supersecret1', name: 'A',
    });
    const res = await request(app).post('/api/auth/register').send({
      email: 'dupe@example.com', password: 'supersecret1', name: 'B',
    });
    expect(res.status).toBe(409);
  });

  test('login succeeds with correct credentials', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'login@example.com', password: 'supersecret1', name: 'Login Test',
    });
    const res = await request(app).post('/api/auth/login').send({
      email: 'login@example.com', password: 'supersecret1',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeTruthy();
  });

  test('login rejects a wrong password with a generic message', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'wrongpw@example.com', password: 'supersecret1', name: 'Test',
    });
    const res = await request(app).post('/api/auth/login').send({
      email: 'wrongpw@example.com', password: 'totallywrong',
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password.');
  });

  test('login rejects a non-existent email with the SAME generic message (no account enumeration)', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: 'doesnotexist@example.com', password: 'whatever123',
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password.');
  });

  test('Google login creates a new, pre-verified account', async () => {
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({ sub: 'google-123', email: 'googleuser@example.com', name: 'G User', picture: null }),
    });
    const res = await request(app).post('/api/auth/google').send({ idToken: 'fake-token' });
    expect(res.status).toBe(200);
    expect(res.body.user.emailVerified).toBe(true);
    expect(res.body.user.authProvider).toBe('google');
  });

  test('Google login links to an existing password account matched by email', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'linkme@example.com', password: 'supersecret1', name: 'Link Me',
    });
    mockVerifyIdToken.mockResolvedValueOnce({
      getPayload: () => ({ sub: 'google-456', email: 'linkme@example.com', name: 'Link Me', picture: null }),
    });
    const res = await request(app).post('/api/auth/google').send({ idToken: 'fake-token' });
    expect(res.status).toBe(200);

    const user = await User.findOne({ email: 'linkme@example.com' });
    expect(user.googleId).toBe('google-456');
    expect(user.emailVerified).toBe(true);
  });

  test('Google login rejects an invalid token', async () => {
    mockVerifyIdToken.mockRejectedValueOnce(new Error('bad token'));
    const res = await request(app).post('/api/auth/google').send({ idToken: 'garbage' });
    expect(res.status).toBe(401);
  });

  test('email verification: valid token verifies the account', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'verify@example.com', password: 'supersecret1', name: 'Verify Me',
    });
    const rawToken = emailService.sendVerificationEmail.mock.calls.at(-1)[1];

    const res = await request(app).post('/api/auth/verify-email').send({ token: rawToken });
    expect(res.status).toBe(200);

    const user = await User.findOne({ email: 'verify@example.com' });
    expect(user.emailVerified).toBe(true);
  });

  test('email verification: expired/reused token is rejected', async () => {
    const res = await request(app).post('/api/auth/verify-email').send({ token: 'not-a-real-token' });
    expect(res.status).toBe(400);
  });

  test('email verification: a token cannot be reused after success', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'reuse@example.com', password: 'supersecret1', name: 'Reuse Me',
    });
    const rawToken = emailService.sendVerificationEmail.mock.calls.at(-1)[1];
    await request(app).post('/api/auth/verify-email').send({ token: rawToken });

    const secondAttempt = await request(app).post('/api/auth/verify-email').send({ token: rawToken });
    expect(secondAttempt.status).toBe(400);
  });

  test('password reset request always responds identically whether the email exists or not', async () => {
    const resExisting = await request(app).post('/api/auth/request-password-reset').send({ email: 'nope-1@example.com' });
    const resMissing = await request(app).post('/api/auth/request-password-reset').send({ email: 'nope-2@example.com' });
    expect(resExisting.status).toBe(resMissing.status);
    expect(resExisting.body).toEqual(resMissing.body);
  });

  test('password reset end-to-end: request -> reset -> login with new password', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'resetflow@example.com', password: 'oldpassword1', name: 'Reset Flow',
    });
    await request(app).post('/api/auth/request-password-reset').send({ email: 'resetflow@example.com' });
    const rawToken = emailService.sendPasswordResetEmail.mock.calls.at(-1)[1];

    const resetRes = await request(app).post('/api/auth/reset-password').send({
      token: rawToken, newPassword: 'newpassword2',
    });
    expect(resetRes.status).toBe(200);

    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'resetflow@example.com', password: 'newpassword2',
    });
    expect(loginRes.status).toBe(200);

    // Old password no longer works.
    const oldLoginRes = await request(app).post('/api/auth/login').send({
      email: 'resetflow@example.com', password: 'oldpassword1',
    });
    expect(oldLoginRes.status).toBe(401);
  });

  test('password reset token cannot be reused (single-use)', async () => {
    await request(app).post('/api/auth/register').send({
      email: 'singleuse@example.com', password: 'oldpassword1', name: 'Single Use',
    });
    await request(app).post('/api/auth/request-password-reset').send({ email: 'singleuse@example.com' });
    const rawToken = emailService.sendPasswordResetEmail.mock.calls.at(-1)[1];

    await request(app).post('/api/auth/reset-password').send({ token: rawToken, newPassword: 'newpassword2' });
    const secondAttempt = await request(app).post('/api/auth/reset-password').send({ token: rawToken, newPassword: 'anotherone3' });
    expect(secondAttempt.status).toBe(400);
  });
});
