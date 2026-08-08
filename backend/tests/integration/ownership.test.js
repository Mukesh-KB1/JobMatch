import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createUser, createResume, createJob, createMatch, createApplication, authHeader } from '../helpers.js';

const app = createApp();

describe('Ownership / IDOR protection', () => {
  test('GET /api/resumes/:id returns 404 (not the data, not 403) for another user\'s resume', async () => {
    const owner = await createUser();
    const attacker = await createUser();
    const resume = await createResume(owner._id);

    const res = await request(app).get(`/api/resumes/${resume._id}`).set(authHeader(attacker));

    expect(res.status).toBe(404);
    expect(res.body).not.toHaveProperty('resume');
  });

  test('DELETE /api/resumes/:id returns 404 for another user\'s resume and does not delete it', async () => {
    const owner = await createUser();
    const attacker = await createUser();
    const resume = await createResume(owner._id);

    const res = await request(app).delete(`/api/resumes/${resume._id}`).set(authHeader(attacker));
    expect(res.status).toBe(404);

    // Still fetchable by the real owner - proves it wasn't deleted.
    const ownerRes = await request(app).get(`/api/resumes/${resume._id}`).set(authHeader(owner));
    expect(ownerRes.status).toBe(200);
  });

  test('The rightful owner still gets 200 for their own resume', async () => {
    const owner = await createUser();
    const resume = await createResume(owner._id);
    const res = await request(app).get(`/api/resumes/${resume._id}`).set(authHeader(owner));
    expect(res.status).toBe(200);
    expect(res.body.resume._id).toBe(String(resume._id));
  });

  test('GET /api/matches/:id returns 404 for another user\'s match', async () => {
    const owner = await createUser();
    const attacker = await createUser();
    const resume = await createResume(owner._id);
    const job = await createJob();
    const match = await createMatch(owner._id, job._id, resume._id);

    const res = await request(app).get(`/api/matches/${match._id}`).set(authHeader(attacker));
    expect(res.status).toBe(404);
  });

  test('GET /api/applications/:id returns 404 for another user\'s application', async () => {
    const owner = await createUser();
    const attacker = await createUser();
    const job = await createJob();
    const application = await createApplication(owner._id, job._id);

    const res = await request(app).get(`/api/applications/${application._id}`).set(authHeader(attacker));
    expect(res.status).toBe(404);
  });

  test('List endpoints only ever return the caller\'s own resources', async () => {
    const owner = await createUser();
    const attacker = await createUser();
    await createResume(owner._id);

    const res = await request(app).get('/api/resumes').set(authHeader(attacker));
    expect(res.status).toBe(200);
    expect(res.body.resumes).toEqual([]);
  });

  test('A malformed / non-existent id also returns 404, not a 500', async () => {
    const user = await createUser();
    const res = await request(app).get('/api/resumes/not-a-valid-object-id').set(authHeader(user));
    expect(res.status).toBe(404);
  });

  test('Requests without a valid JWT are rejected with 401 before ownership is even evaluated', async () => {
    const owner = await createUser();
    const resume = await createResume(owner._id);
    const res = await request(app).get(`/api/resumes/${resume._id}`);
    expect(res.status).toBe(401);
  });
});
