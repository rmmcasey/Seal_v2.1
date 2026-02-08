/**
 * Seal Receiver - .seal file drop zone and viewer redirect
 *
 * This is the extension popup (action popup) for receiving/opening .seal files.
 */

(function () {
  'use strict';

  // --- DOM Elements ---
  const screens = {
    drop: document.getElementById('screen-drop'),
    info: document.getElementById('screen-info'),
    error: document.getElementById('screen-error')
  };

  const els = {
    dropZone: document.getElementById('drop-zone'),
    fileInput: document.getElementById('file-input'),
    btnBrowse: document.getElementById('btn-browse'),
    infoFilename: document.getElementById('info-filename'),
    infoSize: document.getElementById('info-size'),
    infoDate: document.getElementById('info-date'),
    infoExpires: document.getElementById('info-expires'),
    infoRecipients: document.getElementById('info-recipients'),
    btnOpenViewer: document.getElementById('btn-open-viewer'),
    btnBack: document.getElementById('btn-back'),
    errorMessage: document.getElementById('error-message'),
    btnErrorBack: document.getElementById('btn-error-back')
  };

  let currentSealFile = null;

  // --- Screen Management ---
  function showScreen(name) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[name].classList.add('active');
  }

  // --- Event Listeners ---
  function init() {
    // Drop zone events
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
      if (file) handleFile(file);
    });

    els.dropZone.addEventListener('click', () => els.fileInput.click());
    els.btnBrowse.addEventListener('click', (e) => {
      e.stopPropagation();
      els.fileInput.click();
    });

    els.fileInput.addEventListener('change', (e) => {
      if (e.target.files[0]) handleFile(e.target.files[0]);
    });

    // Info screen buttons
    els.btnOpenViewer.addEventListener('click', openInViewer);
    els.btnBack.addEventListener('click', () => {
      currentSealFile = null;
      els.fileInput.value = '';
      showScreen('drop');
    });

    // Error screen
    els.btnErrorBack.addEventListener('click', () => {
      currentSealFile = null;
      els.fileInput.value = '';
      showScreen('drop');
    });
  }

  // --- File Handling ---
  async function handleFile(file) {
    // Validate file extension
    if (!file.name.endsWith('.seal')) {
      showError('Please select a .seal file. This file type is not supported.');
      return;
    }

    try {
      const text = await file.text();
      const sealFile = JSON.parse(text);

      // Validate structure
      if (!sealFile.version || !sealFile.fileId || !sealFile.payload) {
        showError('This file is not a valid .seal file. It may be corrupted or incomplete.');
        return;
      }

      currentSealFile = sealFile;
      displayFileInfo(sealFile, file.size);

    } catch (err) {
      if (err instanceof SyntaxError) {
        showError('Could not read this file. It may be corrupted.');
      } else {
        showError('An unexpected error occurred: ' + err.message);
      }
    }
  }

  // --- Display File Info ---
  function displayFileInfo(sealFile, fileSize) {
    const meta = sealFile.metadata || {};

    els.infoFilename.textContent = meta.originalName || 'Unknown file';
    els.infoSize.textContent = formatFileSize(meta.originalSize || fileSize);

    // Encrypted date
    if (meta.encryptedAt) {
      els.infoDate.textContent = new Date(meta.encryptedAt).toLocaleDateString();
    } else {
      els.infoDate.textContent = 'Unknown';
    }

    // Expiration
    if (meta.expiresAt) {
      const expiresAt = new Date(meta.expiresAt);
      const isExpired = expiresAt < new Date();
      if (isExpired) {
        els.infoExpires.innerHTML = '<span class="expired-badge">Expired</span>';
        els.btnOpenViewer.disabled = true;
        els.btnOpenViewer.textContent = 'File has expired';
      } else {
        els.infoExpires.textContent = expiresAt.toLocaleDateString();
        els.btnOpenViewer.disabled = false;
        els.btnOpenViewer.textContent = 'Open in Secure Viewer';
      }
    } else {
      els.infoExpires.textContent = 'Never';
    }

    // Recipients
    if (sealFile.recipients && sealFile.recipients.length > 0) {
      const emails = sealFile.recipients.map(r => r.email);
      els.infoRecipients.textContent = emails.length <= 2
        ? emails.join(', ')
        : `${emails[0]} +${emails.length - 1} more`;
      els.infoRecipients.title = emails.join(', ');
    } else {
      els.infoRecipients.textContent = 'Unknown';
    }

    showScreen('info');
  }

  // --- Open in Viewer ---
  function openInViewer() {
    if (!currentSealFile) return;

    // Store the seal file data for the viewer
    // Use chrome.storage.session for secure, temporary storage
    const sealData = JSON.stringify(currentSealFile);

    // Try chrome.storage.session first (Manifest V3)
    if (chrome.storage && chrome.storage.session) {
      chrome.storage.session.set({ pendingSealFile: sealData }, () => {
        chrome.tabs.create({
          url: `https://seal.email/viewer?ext=true&fileId=${currentSealFile.fileId}`
        });
      });
    } else {
      // Fallback: encode in URL (for smaller files) or use local storage
      try {
        // For larger files, store in chrome.storage.local with a temp key
        const tempKey = 'seal_temp_' + currentSealFile.fileId;
        chrome.storage.local.set({ [tempKey]: sealData }, () => {
          chrome.tabs.create({
            url: `https://seal.email/viewer?ext=true&fileId=${currentSealFile.fileId}&key=${tempKey}`
          });
        });
      } catch (err) {
        console.error('[Seal] Failed to store file data:', err);
        showError('Could not open file. Please try again.');
      }
    }
  }

  // --- Error ---
  function showError(message) {
    els.errorMessage.textContent = message;
    showScreen('error');
  }

  // --- Helpers ---
  function formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // --- Start ---
  init();
})();
