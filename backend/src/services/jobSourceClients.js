import { config } from '../config/env.js';
import { extractSkills } from '../utils/skillsDictionary.js';
import { stripHtml } from '../utils/htmlUtils.js';

// Each client normalizes a source's response shape into the fields
// jobRepository.upsertFromSource expects. Isolated in one module so tests
// can jest.mock() the whole thing without touching real network calls.

export async function fetchAdzunaPage({ query, country, page = 1 }) {
  if (!config.adzuna.appId || !config.adzuna.appKey) return [];
  const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`);
  url.searchParams.set('app_id', config.adzuna.appId);
  url.searchParams.set('app_key', config.adzuna.appKey);
  url.searchParams.set('what', query);
  url.searchParams.set('results_per_page', '20');

  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Adzuna request failed: ${res.status}`);
  const data = await res.json();

  return (data.results || []).map((r) => {
    const description = stripHtml(r.description || '');
    return {
      source: 'adzuna',
      externalId: String(r.id),
      title: r.title,
      company: r.company?.display_name || 'Unknown',
      location: r.location?.display_name || '',
      country,
      description,
      requiredSkills: extractSkills(description || r.title || ''),
      applyUrl: r.redirect_url,
      salary: r.salary_min || r.salary_max ? `${r.salary_min || ''}-${r.salary_max || ''}` : null,
      remote: /remote/i.test(r.location?.display_name || ''),
      postedAt: r.created ? new Date(r.created) : new Date(),
    };
  });
}

export async function fetchJoobleResults({ query }) {
  if (!config.jooble.apiKey) return [];
  const url = `https://jooble.org/api/${config.jooble.apiKey}`;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ keywords: query }),
  });
  if (!res.ok) throw new Error(`Jooble request failed: ${res.status}`);
  const data = await res.json();

  return (data.jobs || []).map((r) => {
    const description = stripHtml(r.snippet || '');
    return {
      source: 'jooble',
      externalId: r.id ? String(r.id) : `${r.link}`,
      title: r.title,
      company: r.company || 'Unknown',
      location: r.location || '',
      country: '',
      description,
      requiredSkills: extractSkills(description || r.title || ''),
      applyUrl: r.link,
      salary: r.salary || null,
      remote: /remote/i.test(r.location || ''),
      postedAt: r.updated ? new Date(r.updated) : new Date(),
    };
  });
}

// No key required, no meaningful limit - one call returns the whole current board.
export async function fetchArbeitnowBoard() {
  const res = await fetch('https://arbeitnow.com/api/job-board-api');
  if (!res.ok) throw new Error(`Arbeitnow request failed: ${res.status}`);
  const data = await res.json();

  return (data.data || []).map((r) => {
    const description = stripHtml(r.description || '');
    return {
      source: 'arbeitnow',
      externalId: String(r.slug),
      title: r.title,
      company: r.company_name || 'Unknown',
      location: r.location || '',
      country: '',
      description,
      requiredSkills: extractSkills((r.tags || []).join(' ') + ' ' + description),
      applyUrl: r.url,
      salary: null,
      remote: !!r.remote,
      postedAt: r.created_at ? new Date(r.created_at * 1000) : new Date(),
    };
  });
}