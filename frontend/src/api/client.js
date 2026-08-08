const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

function getToken() {
  return localStorage.getItem('jobmatch_token');
}

export function setToken(token) {
  if (token) localStorage.setItem('jobmatch_token', token);
  else localStorage.removeItem('jobmatch_token');
}

async function request(path, { method = 'GET', body, isForm = false } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  if (!isForm && body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API_BASE_URL}${path}`, {
    method,
    headers,
    body: isForm ? body : body !== undefined ? JSON.stringify(body) : undefined,
  });

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = null; }
  }

  if (!res.ok) {
    const message = (data && data.error) || `Request failed (${res.status}).`;
    const err = new Error(message);
    err.status = res.status;
    throw err;
  }
  return data;
}

export const api = {
  // Auth
  register: (payload) => request('/auth/register', { method: 'POST', body: payload }),
  login: (payload) => request('/auth/login', { method: 'POST', body: payload }),
  googleLogin: (idToken) => request('/auth/google', { method: 'POST', body: { idToken } }),
  me: () => request('/auth/me'),
  verifyEmail: (token) => request('/auth/verify-email', { method: 'POST', body: { token } }),
  requestPasswordReset: (email) => request('/auth/request-password-reset', { method: 'POST', body: { email } }),
  resetPassword: (token, newPassword) => request('/auth/reset-password', { method: 'POST', body: { token, newPassword } }),

  // Resumes
  listResumes: () => request('/resumes'),
  uploadResume: (file) => {
    const form = new FormData();
    form.append('resume', file);
    return request('/resumes', { method: 'POST', body: form, isForm: true });
  },
  deleteResume: (id) => request(`/resumes/${id}`, { method: 'DELETE' }),

  // Jobs
  listJobs: (page = 1, country = '', search = '') =>
    request(`/jobs?page=${page}${country ? `&country=${encodeURIComponent(country)}` : ''}${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  getJob: (id) => request(`/jobs/${id}`),
  jobsFreshness: () => request('/jobs/meta/freshness'),
  jobsCountries: () => request('/jobs/meta/countries'),

  // Matches
  scoreJob: (jobId) => request(`/matches/jobs/${jobId}`, { method: 'POST' }),
  listMatches: () => request('/matches'),

  // Applications
  applyToJob: (jobId) => request(`/applications/jobs/${jobId}`, { method: 'POST' }),
  listApplications: () => request('/applications'),
};