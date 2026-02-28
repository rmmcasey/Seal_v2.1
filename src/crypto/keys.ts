/**
 * Key generation, import/export, and management using Web Crypto API.
 * All crypto operations happen exclusively in the browser.
 */

const RSA_ALGORITHM: RsaHashedKeyGenParams = {
  name: 'RSA-OAEP',
  modulusLength: 4096,
  publicExponent: new Uint8Array([1, 0, 1]),
  hash: 'SHA-256',
}

const AES_KEY_WRAP_ALGORITHM = { name: 'AES-GCM', length: 256 }

// ─── RSA Key Pair ───────────────────────────────────────────────────────────

export async function generateRSAKeyPair(): Promise<CryptoKeyPair> {
  return crypto.subtle.generateKey(RSA_ALGORITHM, true, ['wrapKey', 'unwrapKey'])
}

export async function exportPublicKeyToBase64(publicKey: CryptoKey): Promise<string> {
  const spki = await crypto.subtle.exportKey('spki', publicKey)
  return arrayBufferToBase64(spki)
}

export async function importPublicKeyFromBase64(base64: string): Promise<CryptoKey> {
  const spki = base64ToArrayBuffer(base64)
  return crypto.subtle.importKey('spki', spki, RSA_ALGORITHM, true, ['wrapKey'])
}

export async function importPrivateKeyFromBase64(base64: string): Promise<CryptoKey> {
  const pkcs8 = base64ToArrayBuffer(base64)
  return crypto.subtle.importKey('pkcs8', pkcs8, RSA_ALGORITHM, true, ['unwrapKey'])
}

// ─── Private Key Encryption (password-based) ─────────────────────────────────

export interface EncryptedKeyBlob {
  encryptedKey: string  // base64
  iv: string            // base64
  salt: string          // base64
}

export async function encryptPrivateKey(
  privateKey: CryptoKey,
  password: string,
  salt: Uint8Array
): Promise<EncryptedKeyBlob> {
  const derivedKey = await deriveKeyFromPassword(password, salt)
  const pkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey)
  const iv = crypto.getRandomValues(new Uint8Array(12))

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    pkcs8
  )

  return {
    encryptedKey: arrayBufferToBase64(encrypted),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
    salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
  }
}

export async function decryptPrivateKey(
  blob: EncryptedKeyBlob,
  password: string
): Promise<CryptoKey> {
  const salt = base64ToArrayBuffer(blob.salt)
  const iv = base64ToArrayBuffer(blob.iv)
  const encryptedKey = base64ToArrayBuffer(blob.encryptedKey)

  const derivedKey = await deriveKeyFromPassword(password, new Uint8Array(salt))

  const pkcs8 = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    derivedKey,
    encryptedKey
  )

  return crypto.subtle.importKey('pkcs8', pkcs8, RSA_ALGORITHM, true, ['unwrapKey'])
}

// ─── PBKDF2 Key Derivation ──────────────────────────────────────────────────

async function deriveKeyFromPassword(
  password: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  )

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt.buffer as ArrayBuffer,
      iterations: 600_000,
      hash: 'SHA-256',
    },
    keyMaterial,
    AES_KEY_WRAP_ALGORITHM,
    false,
    ['encrypt', 'decrypt']
  )
}

export function generateSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(32))
}

// ─── Public Key Fingerprint ──────────────────────────────────────────────────

export async function getPublicKeyFingerprint(publicKeyBase64: string): Promise<string> {
  const raw = base64ToArrayBuffer(publicKeyBase64)
  const hash = await crypto.subtle.digest('SHA-256', raw)
  const hex = Array.from(new Uint8Array(hash))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
  // Format as colon-separated pairs like SSH fingerprints
  return hex.match(/.{2}/g)!.slice(0, 16).join(':')
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i)
  }
  return bytes.buffer as ArrayBuffer
}
