/**
 * Seal Crypto Library
 * Client-side encryption for .seal files using Web Crypto API
 *
 * Encryption scheme:
 * - AES-256-GCM for file content encryption
 * - RSA-OAEP (2048-bit) for per-recipient key wrapping
 * - Each .seal file contains the encrypted content + wrapped keys for all recipients
 */

class SealCrypto {
  constructor() {
    this.ALGORITHM = 'AES-GCM';
    this.KEY_LENGTH = 256;
    this.IV_LENGTH = 12;
    this.SEAL_VERSION = '1.0';
  }

  /**
   * Generate a unique file ID
   */
  generateFileId() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  /**
   * Generate a random AES-256 key for file encryption
   */
  async generateFileKey() {
    return crypto.subtle.generateKey(
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /**
   * Encrypt file content with AES-256-GCM
   */
  async encryptContent(fileBuffer, key) {
    const iv = crypto.getRandomValues(new Uint8Array(this.IV_LENGTH));
    const encrypted = await crypto.subtle.encrypt(
      { name: this.ALGORITHM, iv },
      key,
      fileBuffer
    );
    return { encrypted, iv };
  }

  /**
   * Decrypt file content with AES-256-GCM
   */
  async decryptContent(encryptedBuffer, key, iv) {
    return crypto.subtle.decrypt(
      { name: this.ALGORITHM, iv },
      key,
      encryptedBuffer
    );
  }

  /**
   * Import an RSA public key from JWK format
   */
  async importPublicKey(jwk) {
    return crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['wrapKey']
    );
  }

  /**
   * Import an RSA private key from JWK format
   */
  async importPrivateKey(jwk) {
    return crypto.subtle.importKey(
      'jwk',
      jwk,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['unwrapKey']
    );
  }

  /**
   * Wrap (encrypt) the file key for a specific recipient using their public key
   */
  async wrapKeyForRecipient(fileKey, recipientPublicKey) {
    const wrappedKey = await crypto.subtle.wrapKey(
      'raw',
      fileKey,
      recipientPublicKey,
      { name: 'RSA-OAEP' }
    );
    return wrappedKey;
  }

  /**
   * Unwrap (decrypt) the file key using recipient's private key
   */
  async unwrapFileKey(wrappedKeyBuffer, privateKey) {
    return crypto.subtle.unwrapKey(
      'raw',
      wrappedKeyBuffer,
      privateKey,
      { name: 'RSA-OAEP' },
      { name: this.ALGORITHM, length: this.KEY_LENGTH },
      false,
      ['decrypt']
    );
  }

  /**
   * Convert ArrayBuffer to base64 string
   */
  arrayBufferToBase64(buffer) {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  /**
   * Convert base64 string to ArrayBuffer
   */
  base64ToArrayBuffer(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  /**
   * Read a File object as ArrayBuffer
   */
  readFileAsArrayBuffer(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Create a .seal file from a source file
   *
   * @param {File} file - The file to encrypt
   * @param {Array} recipients - Array of {email, publicKey (JWK)} objects
   * @param {string} fileId - Unique file identifier
   * @param {Object} options - {expiresAt: ISO string}
   * @returns {Object} The .seal file data
   */
  async createSealFile(file, recipients, fileId, options = {}) {
    // Read file content
    const fileBuffer = await this.readFileAsArrayBuffer(file);

    // Generate a random AES key for this file
    const fileKey = await this.generateFileKey();

    // Encrypt the file content
    const { encrypted, iv } = await this.encryptContent(fileBuffer, fileKey);

    // Wrap the file key for each recipient
    const recipientKeys = [];
    for (const recipient of recipients) {
      const publicKey = await this.importPublicKey(recipient.publicKey);
      const wrappedKey = await this.wrapKeyForRecipient(fileKey, publicKey);
      recipientKeys.push({
        email: recipient.email,
        wrappedKey: this.arrayBufferToBase64(wrappedKey)
      });
    }

    // Build the .seal file structure
    const sealFile = {
      version: this.SEAL_VERSION,
      fileId: fileId,
      metadata: {
        originalName: file.name,
        originalSize: file.size,
        originalType: file.type || 'application/octet-stream',
        encryptedAt: new Date().toISOString(),
        expiresAt: options.expiresAt || null
      },
      encryption: {
        algorithm: 'AES-256-GCM',
        keyWrapping: 'RSA-OAEP-SHA256',
        iv: this.arrayBufferToBase64(iv.buffer)
      },
      recipients: recipientKeys,
      payload: this.arrayBufferToBase64(encrypted)
    };

    return sealFile;
  }

  /**
   * Decrypt a .seal file
   *
   * @param {Object} sealFile - Parsed .seal file data
   * @param {string} userEmail - Current user's email
   * @param {Object} privateKeyJwk - User's private key in JWK format
   * @returns {Object} {data: ArrayBuffer, metadata: Object}
   */
  async decryptSealFile(sealFile, userEmail, privateKeyJwk) {
    // Find the recipient entry for this user
    const recipientEntry = sealFile.recipients.find(
      r => r.email.toLowerCase() === userEmail.toLowerCase()
    );

    if (!recipientEntry) {
      throw new Error('You are not an authorized recipient of this file');
    }

    // Check expiration
    if (sealFile.metadata.expiresAt) {
      const expiresAt = new Date(sealFile.metadata.expiresAt);
      if (expiresAt < new Date()) {
        throw new Error('This sealed file has expired');
      }
    }

    // Import private key
    const privateKey = await this.importPrivateKey(privateKeyJwk);

    // Unwrap the file key
    const wrappedKeyBuffer = this.base64ToArrayBuffer(recipientEntry.wrappedKey);
    const fileKey = await this.unwrapFileKey(wrappedKeyBuffer, privateKey);

    // Decrypt the content
    const iv = new Uint8Array(this.base64ToArrayBuffer(sealFile.encryption.iv));
    const encryptedContent = this.base64ToArrayBuffer(sealFile.payload);
    const decryptedContent = await this.decryptContent(encryptedContent, fileKey, iv);

    return {
      data: decryptedContent,
      metadata: sealFile.metadata
    };
  }

  /**
   * Validate a .seal file structure
   */
  validateSealFile(sealFile) {
    const errors = [];

    if (!sealFile.version) errors.push('Missing version');
    if (!sealFile.fileId) errors.push('Missing fileId');
    if (!sealFile.metadata) errors.push('Missing metadata');
    if (!sealFile.encryption) errors.push('Missing encryption info');
    if (!sealFile.recipients || !sealFile.recipients.length) {
      errors.push('Missing recipients');
    }
    if (!sealFile.payload) errors.push('Missing encrypted payload');

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Generate an RSA key pair for a user (for testing/setup)
   */
  async generateKeyPair() {
    const keyPair = await crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256'
      },
      true,
      ['wrapKey', 'unwrapKey']
    );

    const publicKey = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
    const privateKey = await crypto.subtle.exportKey('jwk', keyPair.privateKey);

    return { publicKey, privateKey };
  }
}

// Export for both module and script contexts
if (typeof module !== 'undefined' && module.exports) {
  module.exports = SealCrypto;
}
