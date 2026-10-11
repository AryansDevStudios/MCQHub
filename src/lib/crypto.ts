/**
 * MCQHub Client-Side End-to-End Cryptography Module
 * Uses native Web Crypto API (SubtleCrypto) with AES-256-GCM and PBKDF2.
 * 
 * Guarantees that user AI tokens sent for cross-device cloud sync are strictly
 * encrypted client-side before transmission and storage in Cloud Firestore.
 * Server and database administrators cannot view or extract the plaintext tokens.
 */

const SALT_SIZE = 16;
const IV_SIZE = 12;
const PBKDF2_ITERATIONS = 100000;
const CLIENT_PEPPER = 'MCQHub:ClientSecurity:v1:EncryptedTokenStorage';

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer;
}

async function deriveAesKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const rawKeyMaterial = await window.crypto.subtle.importKey(
    'raw',
    enc.encode(`${passphrase}:${CLIENT_PEPPER}`),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as any,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    rawKeyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts a plaintext string (e.g. Gemini API token) using AES-256-GCM.
 * Returns an encrypted payload string in format: enc:v1:<salt_b64>:<iv_b64>:<ciphertext_b64>
 */
export async function encryptToken(plaintext: string, secretIdentifier: string): Promise<string> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    throw new Error('Web Crypto API is not supported in this environment');
  }

  const salt = window.crypto.getRandomValues(new Uint8Array(SALT_SIZE));
  const iv = window.crypto.getRandomValues(new Uint8Array(IV_SIZE));
  const key = await deriveAesKey(secretIdentifier, salt);

  const enc = new TextEncoder();
  const encodedPlaintext = enc.encode(plaintext);

  const encryptedBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    encodedPlaintext
  );

  const saltB64 = arrayBufferToBase64(salt.buffer);
  const ivB64 = arrayBufferToBase64(iv.buffer);
  const cipherB64 = arrayBufferToBase64(encryptedBuffer);

  return `enc:v1:${saltB64}:${ivB64}:${cipherB64}`;
}

/**
 * Decrypts a previously encrypted token string using AES-256-GCM.
 * Returns the original plaintext string, or null if decryption fails.
 */
export async function decryptToken(encryptedPayload: string, secretIdentifier: string): Promise<string | null> {
  if (typeof window === 'undefined' || !window.crypto || !window.crypto.subtle) {
    return null;
  }

  try {
    if (!encryptedPayload || typeof encryptedPayload !== 'string') {
      return null;
    }

    // Return as-is if not using our encryption format prefix
    if (!encryptedPayload.startsWith('enc:v1:')) {
      return encryptedPayload;
    }

    const parts = encryptedPayload.split(':');
    if (parts.length !== 5) {
      return null;
    }

    const [, , saltB64, ivB64, cipherB64] = parts;
    const salt = new Uint8Array(base64ToArrayBuffer(saltB64));
    const iv = new Uint8Array(base64ToArrayBuffer(ivB64));
    const ciphertext = base64ToArrayBuffer(cipherB64);

    const key = await deriveAesKey(secretIdentifier, salt);

    const decryptedBuffer = await window.crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv,
      },
      key,
      ciphertext
    );

    const dec = new TextDecoder();
    return dec.decode(decryptedBuffer);
  } catch (err) {
    console.warn('Decryption failed for encrypted payload:', err);
    return null;
  }
}
