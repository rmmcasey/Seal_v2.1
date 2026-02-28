/**
 * .seal file format:
 * - A JSON header (newline-terminated) containing metadata and wrapped keys
 * - Followed by the raw encrypted file bytes
 *
 * Header fields:
 *   version: "1"
 *   recipientEmail: string
 *   senderEmail: string
 *   originalFileName: string
 *   originalMimeType: string
 *   wrappedAesKey: base64 (RSA-OAEP wrapped AES-256 key)
 *   iv: base64 (AES-GCM IV)
 */

import { arrayBufferToBase64, base64ToArrayBuffer } from './keys'

export interface SealHeader {
  version: '1'
  recipientEmail: string
  senderEmail: string
  originalFileName: string
  originalMimeType: string
  wrappedAesKey: string
  iv: string
}

const AES_ALGORITHM = { name: 'AES-GCM', length: 256 }

// ─── Encrypt ─────────────────────────────────────────────────────────────────

export async function encryptFile(
  file: File,
  recipientPublicKey: CryptoKey,
  senderEmail: string,
  recipientEmail: string
): Promise<Blob> {
  // Generate ephemeral AES-256-GCM key for this file
  const aesKey = await crypto.subtle.generateKey(AES_ALGORITHM, true, ['encrypt', 'decrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))

  // Encrypt the file content
  const fileBuffer = await file.arrayBuffer()
  const encryptedContent = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    fileBuffer
  )

  // Wrap the AES key with the recipient's RSA public key
  const wrappedKey = await crypto.subtle.wrapKey('raw', aesKey, recipientPublicKey, {
    name: 'RSA-OAEP',
  })

  const header: SealHeader = {
    version: '1',
    recipientEmail,
    senderEmail,
    originalFileName: file.name,
    originalMimeType: file.type || 'application/octet-stream',
    wrappedAesKey: arrayBufferToBase64(wrappedKey),
    iv: arrayBufferToBase64(iv.buffer as ArrayBuffer),
  }

  // Pack: JSON header line + encrypted bytes
  const headerBytes = new TextEncoder().encode(JSON.stringify(header) + '\n')
  const encryptedBytes = new Uint8Array(encryptedContent)

  const combined = new Uint8Array(headerBytes.length + encryptedBytes.length)
  combined.set(headerBytes, 0)
  combined.set(encryptedBytes, headerBytes.length)

  return new Blob([combined], { type: 'application/octet-stream' })
}

// ─── Decrypt ─────────────────────────────────────────────────────────────────

export async function decryptSealFile(
  sealBlob: Blob,
  privateKey: CryptoKey
): Promise<{ file: File; header: SealHeader }> {
  const buffer = await sealBlob.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // Find the newline that separates header from content
  const newlineIndex = bytes.indexOf(0x0a)
  if (newlineIndex === -1) {
    throw new Error('Invalid .seal file: missing header delimiter')
  }

  const headerText = new TextDecoder().decode(bytes.slice(0, newlineIndex))
  const header: SealHeader = JSON.parse(headerText)

  if (header.version !== '1') {
    throw new Error(`Unsupported .seal file version: ${header.version}`)
  }

  const wrappedKey = base64ToArrayBuffer(header.wrappedAesKey)
  const iv = base64ToArrayBuffer(header.iv)
  const encryptedContent = bytes.slice(newlineIndex + 1)

  // Unwrap AES key using the private key
  const aesKey = await crypto.subtle.unwrapKey(
    'raw',
    wrappedKey,
    privateKey,
    { name: 'RSA-OAEP' },
    AES_ALGORITHM,
    false,
    ['decrypt']
  )

  // Decrypt the file content
  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    aesKey,
    encryptedContent
  )

  const decryptedFile = new File([decryptedBuffer], header.originalFileName, {
    type: header.originalMimeType,
  })

  return { file: decryptedFile, header }
}

export function parseSealHeader(sealBlob: Blob): Promise<SealHeader> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const buffer = e.target!.result as ArrayBuffer
      const bytes = new Uint8Array(buffer)
      const newlineIndex = bytes.indexOf(0x0a)
      if (newlineIndex === -1) {
        reject(new Error('Invalid .seal file'))
        return
      }
      try {
        const header = JSON.parse(new TextDecoder().decode(bytes.slice(0, newlineIndex)))
        resolve(header)
      } catch {
        reject(new Error('Corrupt .seal file header'))
      }
    }
    reader.onerror = () => reject(new Error('Failed to read file'))
    reader.readAsArrayBuffer(sealBlob.slice(0, 4096)) // Only read beginning to get header
  })
}
