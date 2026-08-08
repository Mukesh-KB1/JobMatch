import { config } from '../config/env.js';
import { HttpError } from '../middleware/errorHandler.js';

// Thin wrapper around the Gemini REST API, isolated in its own module so
// tests can `jest.mock('../services/geminiClient.js')` cleanly instead of
// mocking global fetch everywhere match scoring is exercised.
export async function scoreResumeAgainstJob({ resumeText, job }) {
  if (!config.gemini.apiKey) {
    throw new HttpError(503, 'AI scoring is not configured on this server.');
  }

  const prompt = buildPrompt(resumeText, job);
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent?key=${config.gemini.apiKey}`;

  let response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json' },
      }),
    });
  } catch (err) {
    console.error('[geminiClient] fetch() itself failed (network/DNS/TLS issue):', err.message);
    throw new HttpError(502, 'Could not reach the AI scoring service.');
  }

  if (!response.ok) {
    // The public error stays generic (don't leak upstream details to the
    // browser), but log the real response so this is debuggable server-side -
    // e.g. 400 = bad request/model name, 401/403 = invalid API key,
    // 404 = model name doesn't exist, 429 = quota exceeded.
    const errorBody = await response.text().catch(() => '<unreadable body>');
    console.error(
      `[geminiClient] Gemini API returned ${response.status} ${response.statusText}. ` +
      `Model="${config.gemini.model}". Body: ${errorBody}`
    );
    throw new HttpError(502, 'The AI scoring service is temporarily unavailable.');
  }

  const data = await response.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new HttpError(502, 'The AI scoring service returned an unexpected response.');
  }

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new HttpError(502, 'The AI scoring service returned malformed data.');
  }

  return {
    score: clampScore(parsed.score),
    summary: String(parsed.summary || ''),
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(String) : [],
    gaps: Array.isArray(parsed.gaps) ? parsed.gaps.map(String) : [],
  };
}

function clampScore(raw) {
  const n = Number(raw);
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(100, Math.round(n)));
}

function buildPrompt(resumeText, job) {
  return `You are an expert technical recruiter. Compare the candidate resume to the job
posting and respond with ONLY a JSON object (no markdown, no prose) of the exact shape:
{"score": <integer 0-100>, "summary": "<2-3 sentence summary>", "strengths": ["..."], "gaps": ["..."]}

Job title: ${job.title}
Company: ${job.company}
Required skills: ${(job.requiredSkills || []).join(', ')}
Job description:
${job.description}

Candidate resume:
${resumeText}`;
}