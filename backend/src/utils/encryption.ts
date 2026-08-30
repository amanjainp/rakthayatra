import crypto from 'crypto';
import { env } from '../config/env';

// Mutable module-level state to support dynamic key rotation on-the-fly
export let keysMap: Record<number, Buffer> = {};
export let ACTIVE_VERSION = 1;
export let ACTIVE_KEY: Buffer = Buffer.alloc(32, 'f') as Buffer;

/**
 * Parses and updates encryption keys mapping dynamically.
 */
export function reloadEncryptionKeys(rawEncryptionKeys: string): void {
  const newKeysMap: Record<number, Buffer> = {};
  const rawKeys = rawEncryptionKeys.split(',');
  let maxVersion = 1;

  for (const raw of rawKeys) {
    const parts = raw.split(':');
    if (parts.length === 2) {
      const version = parseInt(parts[0].trim(), 10);
      const keyStr = parts[1].trim();
      if (!isNaN(version)) {
        const normalized = keyStr.length < 32 
          ? keyStr.padEnd(32, 'f').slice(0, 32)
          : keyStr.slice(0, 32);
        newKeysMap[version] = Buffer.from(normalized, 'utf8') as Buffer;
        if (version > maxVersion) {
          maxVersion = version;
        }
      }
    } else {
      // Backward compatibility fallback for index-based comma-separated key lists
      const index = rawKeys.indexOf(raw);
      const keyStr = raw.trim();
      const normalized = keyStr.length < 32 
        ? keyStr.padEnd(32, 'f').slice(0, 32)
        : keyStr.slice(0, 32);
      newKeysMap[index + 1] = Buffer.from(normalized, 'utf8') as Buffer;
      if (index + 1 > maxVersion) {
        maxVersion = index + 1;
      }
    }
  }

  // Update in-memory configuration atomically
  keysMap = newKeysMap;
  ACTIVE_VERSION = maxVersion;
  ACTIVE_KEY = (keysMap[ACTIVE_VERSION] ?? Buffer.alloc(32, 'f')) as Buffer;
}

// Perform initial reload during startup
reloadEncryptionKeys(env.ENCRYPTION_KEYS || 'v1:default_encryption_key_placeholder');

export interface EncryptedPayload {
  _enc: true;
  v: number;
  iv: string;
  tag: string;
  ciphertext: string;
}

/**
 * Encrypts a string payload using AES-256-GCM.
 */
export function encryptData(plaintext: string): EncryptedPayload {
  const iv = crypto.randomBytes(12); // GCM standard 12-byte IV
  const cipher = crypto.createCipheriv('aes-256-gcm', ACTIVE_KEY, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
  ciphertext += cipher.final('hex');

  const tag = cipher.getAuthTag().toString('hex');

  return {
    _enc: true,
    v: ACTIVE_VERSION,
    iv: iv.toString('hex'),
    tag,
    ciphertext,
  };
}

/**
 * Decrypts an AES-256-GCM payload.
 * Supports fallback to older keys in the rotation list based on version 'v'.
 */
export function decryptData(payload: any): string {
  if (!payload || typeof payload !== 'object' || !payload._enc) {
    // If not marked as encrypted, return as-is (backward compatibility fallback)
    return typeof payload === 'string' ? payload : JSON.stringify(payload);
  }

  const encrypted = payload as EncryptedPayload;
  const key = keysMap[encrypted.v] || ACTIVE_KEY; // Fallback to active key if version out of range

  const ivBuffer = Buffer.from(encrypted.iv, 'hex');
  const tagBuffer = Buffer.from(encrypted.tag, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, ivBuffer);
  decipher.setAuthTag(tagBuffer);

  let decrypted = decipher.update(encrypted.ciphertext, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
