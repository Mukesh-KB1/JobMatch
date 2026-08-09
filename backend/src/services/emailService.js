import { config } from '../config/env.js';

const BREVO_SEND_URL = 'https://api.brevo.com/v3/smtp/email';

// Sends via Brevo's HTTP transactional email API - deliberately NOT raw SMTP.
// Most free-tier PaaS hosts (Render included) block outbound SMTP ports
// (25/465/587) to prevent spam abuse, which made every email silently hang
// or time out in production even though it worked fine locally. This is a
// plain HTTPS POST, same as any other external API call this app already
// makes (Gemini, Adzuna, Jooble), so it isn't affected by that restriction.
async function send({ to, subject, html }) {
  if (!config.brevo.apiKey) {
    // No API key configured (e.g. local dev without keys) - log instead of
    // throwing, so the rest of the app remains usable without email set up.
    console.warn(`[emailService] BREVO_API_KEY not configured - skipping send to ${to}: ${subject}`);
    return { skipped: true };
  }

  const res = await fetch(BREVO_SEND_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'api-key': config.brevo.apiKey,
    },
    body: JSON.stringify({
      sender: { email: config.brevo.fromEmail, name: config.brevo.fromName },
      to: [{ email: to }],
      subject,
      htmlContent: html,
    }),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Brevo API send failed (${res.status}): ${body}`);
  }
  return res.json();
}

export const emailService = {
  async sendVerificationEmail(user, rawToken) {
    const link = `${config.frontendOrigin}/verify-email?token=${rawToken}`;
    return send({
      to: user.email,
      subject: 'Verify your JobMatch email',
      html: `<p>Hi ${user.name},</p><p>Confirm your email to start receiving match digests:</p>
        <p><a href="${link}">Verify my email</a></p>
        <p>This link expires in 24 hours.</p>`,
    });
  },

  async sendPasswordResetEmail(user, rawToken) {
    const link = `${config.frontendOrigin}/reset-password?token=${rawToken}`;
    return send({
      to: user.email,
      subject: 'Reset your JobMatch password',
      html: `<p>Hi ${user.name},</p><p>Someone requested a password reset. If this was you:</p>
        <p><a href="${link}">Reset my password</a></p>
        <p>This link expires in 1 hour. If you didn't request this, you can ignore this email.</p>`,
    });
  },

  async sendLoginNotificationEmail(user) {
    return send({ to: user.email, subject: 'New sign-in to your JobMatch account', html: `<p>Hi ${user.name},</p><p>Your JobMatch account was just signed in to.</p><p>If this was you, no action is needed. If it wasn't, reset your password right away.</p>` });
  },

  async sendPasswordChangedEmail(user) {
    return send({ to: user.email, subject: 'Your JobMatch password was changed', html: `<p>Hi ${user.name},</p><p>Your JobMatch password has been changed successfully.</p><p>If you did not make this change, reset your password immediately and contact support.</p>` });
  },

  // Shared by both the daily digest and the login-triggered digest.
  async sendMatchDigest(user, matches) {
    const rows = matches
      .map((m) => {
        const job = m.jobId; // populated
        return `<tr>
          <td style="padding:8px;border-bottom:1px solid #333;">${job.title} — ${job.company}</td>
          <td style="padding:8px;border-bottom:1px solid #333;">${m.score}/100</td>
          <td style="padding:8px;border-bottom:1px solid #333;"><a href="${job.applyUrl}">Apply now</a></td>
        </tr>`;
      })
      .join('');
    return send({
      to: user.digestEmail || user.email,
      subject: `Your top ${matches.length} JobMatch matches`,
      html: `<p>Hi ${user.name}, here are your best-scoring matches right now:</p>
        <table style="border-collapse:collapse;width:100%;">${rows}</table>`,
    });
  },
};