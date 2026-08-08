import nodemailer from 'nodemailer';
import { config } from '../config/env.js';

// Generic SMTP transport - works with Brevo free tier, Gmail SMTP, or any
// provider. Intentionally not hardcoded to one vendor's SDK.
function buildTransport() {
  if (!config.smtp.host) {
    // No SMTP configured (e.g. local dev without keys) - log instead of throwing,
    // so the rest of the app remains usable.
    return null;
  }
  return nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: config.smtp.port === 465,
    auth: config.smtp.user ? { user: config.smtp.user, pass: config.smtp.pass } : undefined,
  });
}

let transport = buildTransport();

async function send({ to, subject, html }) {
  if (!transport) {
    console.warn(`[emailService] SMTP not configured - skipping send to ${to}: ${subject}`);
    return { skipped: true };
  }
  return transport.sendMail({
    from: config.smtp.fromEmail,
    to,
    subject,
    html,
  });
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

  // Test-only hook to swap the transport with a mock.
  __setTransportForTests(mockTransport) {
    transport = mockTransport;
  },
};
