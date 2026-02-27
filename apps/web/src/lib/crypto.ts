import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';

const KEY_ENV = process.env.AGENTBRIDGE_ENCRYPTION_KEY || process.env.CREDENTIALS_ENCRYPTION_KEY || '';

function getKey(): Buffer {
  if (!KEY_ENV) {
    throw new Error('Credential vault is not configured. Set AGENTBRIDGE_ENCRYPTION_KEY on the server.');
  }

  if (/^[a-f0-9]{64}$/i.test(KEY_ENV.trim())) {
    return Buffer.from(KEY_ENV.trim(), 'hex');
  }

  try {
    const asBase64 = Buffer.from(KEY_ENV, 'base64');
    if (asBase64.length >= 32) {
      return asBase64.subarray(0, 32);
    }
  } catch {
    // Fall back to hashing.
  }

  return createHash('sha256').update(KEY_ENV).digest();
}

export function isCredentialVaultConfigured(): boolean {
  return !!KEY_ENV;
}

export function encryptJson(value: unknown): { ciphertext: string; iv: string; tag: string } {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const plaintext = Buffer.from(JSON.stringify(value), 'utf-8');
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
  };
}

export function decryptJson<T = any>(payload: { ciphertext: string; iv: string; tag: string }): T {
  const key = getKey();
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(payload.iv, 'base64'),
  );
  decipher.setAuthTag(Buffer.from(payload.tag, 'base64'));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(payload.ciphertext, 'base64')),
    decipher.final(),
  ]);
  return JSON.parse(plaintext.toString('utf-8')) as T;
}
