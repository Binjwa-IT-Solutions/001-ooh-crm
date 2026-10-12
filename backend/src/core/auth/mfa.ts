import crypto from 'node:crypto';

import * as OTPAuth from 'otpauth';

import { config } from '../../config/index.js';

const encryptionKey = Buffer.from(config.mfa.encryptionKey, 'hex');

export function encryptTotpSecret(secret: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', encryptionKey, iv);
  const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(
    '.',
  );
}

export function decryptTotpSecret(value: string): string {
  const [ivHex, tagHex, encryptedHex] = value.split('.');
  if (!ivHex || !tagHex || !encryptedHex) throw new Error('Invalid encrypted MFA secret');

  const decipher = crypto.createDecipheriv('aes-256-gcm', encryptionKey, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return Buffer.concat([
    decipher.update(Buffer.from(encryptedHex, 'hex')),
    decipher.final(),
  ]).toString('utf8');
}

export function createTotpSetup(email: string) {
  const secret = new OTPAuth.Secret({ size: 20 });
  const totp = new OTPAuth.TOTP({
    issuer: config.mfa.issuer,
    label: email,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret,
  });

  return {
    secret: secret.base32,
    encryptedSecret: encryptTotpSecret(secret.base32),
    otpauthUrl: totp.toString(),
  };
}

export function verifyTotp(encryptedSecret: string, token: string): number | null {
  const totp = new OTPAuth.TOTP({
    issuer: config.mfa.issuer,
    algorithm: 'SHA1',
    digits: 6,
    period: 30,
    secret: OTPAuth.Secret.fromBase32(decryptTotpSecret(encryptedSecret)),
  });
  const timestamp = Date.now();
  const delta = totp.validate({ token, window: 1, timestamp });
  return delta === null ? null : OTPAuth.TOTP.counter({ timestamp }) + delta;
}
