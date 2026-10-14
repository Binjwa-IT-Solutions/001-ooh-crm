import { config } from '../../config/index.js';
import type { EmailMessage, EmailTransport } from './types.js';

/**
 * Development transport. Prints the email to the server log instead of sending it,
 * so nobody needs an email provider account to log in locally.
 */
export const consoleTransport: EmailTransport = {
  name: 'console',
  async send(message: EmailMessage) {
    console.log(
      [
        '',
        '┌─────────────────────────────────────────────────────────────',
        '│ EMAIL (dev transport — not actually sent)',
        `│ To:      ${message.to}`,
        `│ Subject: ${message.subject}`,
        '├─────────────────────────────────────────────────────────────',
        ...message.text.split('\n').map((line) => `│ ${line}`),
        '└─────────────────────────────────────────────────────────────',
        '',
      ].join('\n'),
    );
  },
};

/**
 * Resend email transport. Set EMAIL_PROVIDER=resend and provide a verified
 * sender plus API key before using email delivery in production.
 */
export const emailTransport: EmailTransport = {
  name: config.email.provider || 'email',
  async send(message) {
    if (config.email.provider.toLowerCase() !== 'resend' || !config.email.apiKey) {
      throw new Error('Email delivery requires EMAIL_PROVIDER=resend and EMAIL_API_KEY.');
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.email.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: config.email.from,
        to: [message.to],
        subject: message.subject,
        text: message.text,
      }),
    });

    if (!response.ok) {
      const body: unknown = await response.json().catch(() => null);
      const detail =
        typeof body === 'object' &&
        body !== null &&
        'message' in body &&
        typeof body.message === 'string'
          ? body.message
          : 'No provider details returned';
      const code =
        typeof body === 'object' && body !== null && 'name' in body && typeof body.name === 'string'
          ? ` ${body.name}`
          : '';

      throw new Error(
        `Email provider rejected the message (HTTP ${response.status}${code}): ${detail}`,
      );
    }
  },
};

export function resolveTransport(): EmailTransport {
  return config.otp.delivery === 'email' ? emailTransport : consoleTransport;
}
