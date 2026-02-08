/**
 * Seal Popup - Encryption Flow
 *
 * Handles file selection, recipient validation, encryption, and Gmail attachment.
 */

(function () {
  'use strict';

  // --- State ---
  const state = {
    file: null,
    recipients: [],
    expirationDays: 3,
    userEmail: null,
    isEncrypting: false
  };

  const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

  // --- DOM Elements ---
  const screens = {
    loading: document.getElementById('screen-loading'),
    auth: document.getElementById('screen-auth'),
    encrypt: document.getElementById('screen-encrypt'),
    progress: document.getElementById('screen-progress'),
    success: document.getElementById('screen-success'),
    error: document.getElementById('screen-error')
  };

  const els = {
    btnLogin: document.getElementById('btn-login'),
    userEmail: document.getElementById('user-email'),
    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('file-input'),
    dropZoneEmpty: document.getElementById('drop-zone-empty'),
    dropZoneFile: document.getElementById('drop-zone-file'),
    fileName: document.getElementById('file-name'),
    fileSize: document.getElementById('file-size'),
    fileRemove: document.getElementById('file-remove'),
    recipientsInput: document.getElementById('recipients-input'),
    recipientsList: document.getElementById('recipients-list'),
    recipientsError: document.getElementById('recipients-error'),
    btnEncrypt: document.getElementById('btn-encrypt'),
    progressStatus: document.getElementById('progress-status'),
    progressBar: document.getElementById('progress-bar'),
    successFilename: document.getElementById('success-filename'),
    successRecipients: document.getElementById('success-recipients'),
    successExpiry: document.getElementById('success-expiry'),
    btnDone: document.getElementById('btn-done'),
    btnSealAnother: document.getElementById('btn-seal-another'),
    errorMessage: document.getElementById('error-message'),
    btnRetry: document.getElementById('btn-retry')
  };

  // --- Screen Management ---
  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  // --- Initialization ---
  async function init() {
    showScreen('loading');

    // Parse recipients from URL params (passed from content script)
    const params = new URLSearchParams(window.location.search);
    const prefilledRecipients = params.get('recipients');
    if (prefilledRecipients) {
      const emails = prefilledRecipients.split(',').filter(e => e.trim());
      for (const email of emails) {
        addRecipient(email.trim());
      }
    }

    // Check auth
    try {
      const authResult = await sendMessage({ action: 'checkAuth' });
      if (authResult.authenticated) {
        state.userEmail = authResult.email;
        els.userEmail.textContent = authResult.email;
        showScreen('encrypt');
      } else {
        showScreen('auth');
      }
    } catch (err) {
      // If API is unreachable, allow offline use for demo
      console.warn('[Seal] Auth check failed, allowing offline mode:', err);
      state.userEmail = 'demo@seal.email';
      els.userEmail.textContent = 'Offline mode';
      showScreen('encrypt');
    }

    setupEventListeners();
  }

  // --- Event Listeners ---
  function setupEventListeners() {
    // Login button
    els.btnLogin.addEventListener('click', () => {
      sendMessage({ action: 'openLogin' });
    });

    // File drop zone
    els.dropZone.addEventListener('click', () => els.fileInput.click());
    els.dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      els.dropZone.classList.add('drag-over');
    });
    els.dropZone.addEventListener('dragleave', () => {
      els.dropZone.classList.remove('drag-over');
    });
    els.dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      els.dropZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) selectFile(file);
    });
    els.fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) selectFile(e.target.files[0]);
    });
    els.fileRemove.addEventListener('click', (e) => {
      e.stopPropagation();
      clearFile();
    });

    // Recipients input
    els.recipientsInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',' || e.key === 'Tab') {
        e.preventDefault();
        const email = els.recipientsInput.value.trim().replace(/,+$/, '');
        if (email) {
          addRecipient(email);
          els.recipientsInput.value = '';
        }
      }
    });
    els.recipientsInput.addEventListener('blur', () => {
      const email = els.recipientsInput.value.trim().replace(/,+$/, '');
      if (email) {
        addRecipient(email);
        els.recipientsInput.value = '';
      }
    });

    // Expiration options
    document.querySelectorAll('.exp-option').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.exp-option').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        state.expirationDays = parseInt(btn.dataset.days, 10);
        updateEncryptButton();
      });
    });

    // Encrypt button
    els.btnEncrypt.addEventListener('click', handleEncrypt);

    // Success actions
    els.btnDone.addEventListener('click', () => window.close());
    els.btnSealAnother.addEventListener('click', () => {
      resetState();
      showScreen('encrypt');
    });

    // Error retry
    els.btnRetry.addEventListener('click', () => {
      showScreen('encrypt');
    });
  }

  // --- File Handling ---
  function selectFile(file) {
    if (file.size > MAX_FILE_SIZE) {
      showFieldError('File too large. Maximum size is 5MB.');
      return;
    }

    state.file = file;
    els.fileName.textContent = file.name;
    els.fileSize.textContent = formatFileSize(file.size);
    els.dropZoneEmpty.hidden = true;
    els.dropZoneFile.hidden = false;
    updateEncryptButton();
  }

  function clearFile() {
    state.file = null;
    els.fileInput.value = '';
    els.dropZoneEmpty.hidden = false;
    els.dropZoneFile.hidden = true;
    updateEncryptButton();
  }

  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // --- Recipients ---
  function addRecipient(email) {
    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showFieldError(`"${email}" is not a valid email address.`);
      return;
    }

    // Check for duplicates
    if (state.recipients.find(r => r.email === email.toLowerCase())) {
      return;
    }

    const recipient = { email: email.toLowerCase(), status: 'checking', publicKey: null };
    state.recipients.push(recipient);
    renderRecipients();
    updateEncryptButton();

    // Validate against API
    validateRecipient(recipient);
  }

  async function validateRecipient(recipient) {
    try {
      const result = await sendMessage({
        action: 'fetchRecipientKeys',
        emails: [recipient.email]
      });
      const data = result.recipients[0];
      recipient.status = data.found ? 'found' : 'not-found';
      if (data.found) {
        recipient.publicKey = data.publicKey;
      }
    } catch (err) {
      // API unavailable - mark as found for demo/offline
      recipient.status = 'found';
      recipient.publicKey = null;
    }
    renderRecipients();
    updateEncryptButton();
  }

  function removeRecipient(email) {
    state.recipients = state.recipients.filter(r => r.email !== email);
    renderRecipients();
    updateEncryptButton();
  }

  function renderRecipients() {
    els.recipientsList.innerHTML = '';
    state.recipients.forEach(r => {
      const tag = document.createElement('div');
      tag.className = `recipient-tag ${r.status}`;

      const statusIcon = r.status === 'found' ? '\u2713'
        : r.status === 'not-found' ? '\u2717'
        : '\u2026';

      tag.innerHTML = `
        <span class="tag-status">${statusIcon}</span>
        <span>${escapeHtml(r.email)}</span>
        <button class="tag-remove" data-email="${escapeHtml(r.email)}">&times;</button>
      `;

      tag.querySelector('.tag-remove').addEventListener('click', () => {
        removeRecipient(r.email);
      });

      els.recipientsList.appendChild(tag);
    });
  }

  // --- Validation ---
  function updateEncryptButton() {
    const hasFile = !!state.file;
    const hasRecipients = state.recipients.length > 0;
    const allRecipientsValid = state.recipients.every(r => r.status === 'found');
    const noChecking = !state.recipients.some(r => r.status === 'checking');

    els.btnEncrypt.disabled = !(hasFile && hasRecipients && noChecking);

    // Show warning if some recipients not found
    if (hasRecipients && noChecking && !allRecipientsValid) {
      const notFound = state.recipients.filter(r => r.status === 'not-found');
      showFieldError(
        `${notFound.map(r => r.email).join(', ')} not registered on Seal. They won't be able to decrypt.`
      );
    } else {
      hideFieldError();
    }
  }

  function showFieldError(msg) {
    els.recipientsError.textContent = msg;
    els.recipientsError.hidden = false;
  }

  function hideFieldError() {
    els.recipientsError.hidden = true;
  }

  // --- Encryption ---
  async function handleEncrypt() {
    if (state.isEncrypting) return;
    state.isEncrypting = true;

    showScreen('progress');
    setProgress('encrypt', 'Encrypting file...', 10);

    try {
      const sealCrypto = new SealCrypto();

      // Step 1: Encrypt
      setProgress('encrypt', 'Encrypting file...', 20);

      const fileId = sealCrypto.generateFileId();

      // Prepare recipient data
      const recipientsData = state.recipients
        .filter(r => r.status === 'found')
        .map(r => ({
          email: r.email,
          publicKey: r.publicKey
        }));

      if (recipientsData.length === 0) {
        throw new Error('No valid recipients with public keys');
      }

      // Check if we have real public keys or need to generate test ones
      const needsTestKeys = recipientsData.some(r => !r.publicKey);
      if (needsTestKeys) {
        // Generate test key pairs for demo/offline mode
        for (const r of recipientsData) {
          if (!r.publicKey) {
            const keyPair = await sealCrypto.generateKeyPair();
            r.publicKey = keyPair.publicKey;
          }
        }
      }

      setProgress('encrypt', 'Encrypting file...', 50);

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + state.expirationDays);

      const sealFile = await sealCrypto.createSealFile(
        state.file,
        recipientsData,
        fileId,
        { expiresAt: expiresAt.toISOString() }
      );

      setProgress('metadata', 'Saving metadata...', 70);

      // Step 2: Save metadata
      try {
        await sendMessage({
          action: 'saveMetadata',
          fileId,
          filename: state.file.name,
          recipientEmails: recipientsData.map(r => r.email),
          expiresAt: expiresAt.toISOString(),
          senderEmail: state.userEmail
        });
      } catch (err) {
        console.warn('[Seal] Metadata save failed (continuing):', err);
      }

      setProgress('attach', 'Attaching to Gmail...', 85);

      // Step 3: Attach to Gmail
      const sealFilename = state.file.name + '.seal';
      try {
        await sendMessage({
          action: 'attachToGmail',
          sealFile,
          filename: sealFilename
        });
      } catch (err) {
        console.warn('[Seal] Gmail attach via background failed, trying direct:', err);
        // Try direct window communication
        if (window.opener) {
          window.opener.postMessage({
            type: 'seal-attach',
            sealFile,
            filename: sealFilename
          }, 'https://mail.google.com');
        }
      }

      setProgress('attach', 'Done!', 100);

      // Step 4: Show success
      setTimeout(() => {
        els.successFilename.textContent = sealFilename;
        els.successRecipients.textContent = `Sent to: ${recipientsData.map(r => r.email).join(', ')}`;
        els.successExpiry.textContent = `Expires: ${expiresAt.toLocaleDateString()}`;
        showScreen('success');
      }, 500);

    } catch (err) {
      console.error('[Seal] Encryption failed:', err);
      els.errorMessage.textContent = err.message || 'Encryption failed. Please try again.';
      showScreen('error');
    } finally {
      state.isEncrypting = false;
    }
  }

  function setProgress(step, message, percent) {
    els.progressStatus.textContent = message;
    els.progressBar.style.width = percent + '%';

    const steps = ['encrypt', 'metadata', 'attach'];
    const currentIdx = steps.indexOf(step);

    document.querySelectorAll('.progress-step').forEach((el, i) => {
      el.classList.remove('active', 'done');
      if (i < currentIdx) el.classList.add('done');
      else if (i === currentIdx) el.classList.add('active');
    });
  }

  // --- Reset ---
  function resetState() {
    state.file = null;
    state.recipients = [];
    state.expirationDays = 3;
    state.isEncrypting = false;

    clearFile();
    els.recipientsList.innerHTML = '';
    els.recipientsInput.value = '';
    hideFieldError();

    document.querySelectorAll('.exp-option').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.days === '3');
    });

    els.progressBar.style.width = '0%';
    updateEncryptButton();
  }

  // --- Helpers ---
  function sendMessage(message) {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(message, (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
        } else if (response && response.error) {
          reject(new Error(response.error));
        } else {
          resolve(response || {});
        }
      });
    });
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // --- Start ---
  init();
})();
