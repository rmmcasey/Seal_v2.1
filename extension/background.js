/**
 * Seal Background Service Worker
 *
 * Handles:
 * - API calls to seal.email (auth, keys, metadata)
 * - Message routing between popup and content script
 * - Extension lifecycle management
 */

const API_BASE = 'https://seal.email/api';

/**
 * Check if user is authenticated with Seal
 */
async function checkAuth() {
  try {
    const response = await fetch(`${API_BASE}/auth/status`, {
      credentials: 'include'
    });
    if (!response.ok) return { authenticated: false };
    return await response.json();
  } catch (err) {
    console.error('[Seal] Auth check failed:', err);
    return { authenticated: false, error: err.message };
  }
}

/**
 * Fetch a recipient's public key
 */
async function fetchPublicKey(email) {
  try {
    const response = await fetch(
      `${API_BASE}/users/public-key/${encodeURIComponent(email)}`,
      { credentials: 'include' }
    );
    if (!response.ok) {
      if (response.status === 404) {
        return { found: false, email };
      }
      throw new Error(`Failed to fetch key for ${email}`);
    }
    const data = await response.json();
    return { found: true, email, publicKey: data.publicKey };
  } catch (err) {
    console.error(`[Seal] Key fetch failed for ${email}:`, err);
    return { found: false, email, error: err.message };
  }
}

/**
 * Save file metadata to Seal API
 */
async function saveFileMetadata(fileId, filename, recipientEmails, expiresAt, senderEmail) {
  try {
    const response = await fetch(`${API_BASE}/files`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fileId,
        filename,
        recipientEmails,
        expiresAt,
        senderEmail
      })
    });
    if (!response.ok) throw new Error('Failed to save file metadata');
    return await response.json();
  } catch (err) {
    console.error('[Seal] Metadata save failed:', err);
    throw err;
  }
}

/**
 * Handle messages from popup and content scripts
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const handler = messageHandlers[request.action];
  if (handler) {
    handler(request, sender)
      .then(sendResponse)
      .catch(err => sendResponse({ error: err.message }));
    return true; // Keep message channel open for async response
  }
});

const messageHandlers = {
  /**
   * Check authentication status
   */
  async checkAuth() {
    return await checkAuth();
  },

  /**
   * Fetch public keys for multiple recipients
   */
  async fetchRecipientKeys(request) {
    const { emails } = request;
    const results = await Promise.all(emails.map(fetchPublicKey));
    return { recipients: results };
  },

  /**
   * Save encrypted file metadata
   */
  async saveMetadata(request) {
    const { fileId, filename, recipientEmails, expiresAt, senderEmail } = request;
    return await saveFileMetadata(fileId, filename, recipientEmails, expiresAt, senderEmail);
  },

  /**
   * Forward attach message to content script
   */
  async attachToGmail(request) {
    const tabs = await chrome.tabs.query({
      active: true,
      currentWindow: true,
      url: 'https://mail.google.com/*'
    });

    if (tabs.length === 0) {
      throw new Error('No Gmail tab found');
    }

    return new Promise((resolve, reject) => {
      chrome.tabs.sendMessage(tabs[0].id, {
        action: 'attachSealFile',
        sealFile: request.sealFile,
        filename: request.filename
      }, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else {
          resolve(response);
        }
      });
    });
  },

  /**
   * Open Seal login page
   */
  async openLogin() {
    await chrome.tabs.create({ url: 'https://seal.email/login' });
    return { success: true };
  }
};

/**
 * Extension install/update handler
 */
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    console.log('[Seal] Extension installed');
  } else if (details.reason === 'update') {
    console.log('[Seal] Extension updated to', chrome.runtime.getManifest().version);
  }
});
