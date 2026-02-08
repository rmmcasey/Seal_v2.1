/**
 * Seal Content Script - Injected into Gmail
 *
 * Responsibilities:
 * 1. Detect Gmail compose windows
 * 2. Inject "Seal" button into compose toolbar
 * 3. Handle messages from popup/background to attach .seal files
 */

(function () {
  'use strict';

  const SEAL_BUTTON_CLASS = 'seal-compose-btn';
  const SEAL_ICON_SVG = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2C9.24 2 7 4.24 7 7V10H6C4.9 10 4 10.9 4 12V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V12C20 10.9 19.1 10 18 10H17V7C17 4.24 14.76 2 12 2ZM12 4C13.66 4 15 5.34 15 7V10H9V7C9 5.34 10.34 4 12 4ZM12 14C13.1 14 14 14.9 14 16C14 17.1 13.1 18 12 18C10.9 18 10 17.1 10 16C10 14.9 10.9 14 12 14Z" fill="currentColor"/>
  </svg>`;

  // Track compose windows we've already injected into
  const injectedComposeWindows = new WeakSet();

  /**
   * Create the Seal button element
   */
  function createSealButton() {
    const button = document.createElement('div');
    button.className = SEAL_BUTTON_CLASS;
    button.setAttribute('role', 'button');
    button.setAttribute('tabindex', '0');
    button.setAttribute('data-tooltip', 'Seal - Encrypt & Attach');
    button.setAttribute('aria-label', 'Seal - Encrypt and attach file');
    button.innerHTML = `
      <div class="seal-btn-inner">
        ${SEAL_ICON_SVG}
      </div>
    `;

    button.addEventListener('click', handleSealButtonClick);
    button.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        handleSealButtonClick(e);
      }
    });

    return button;
  }

  /**
   * Handle click on Seal button - open popup window
   */
  function handleSealButtonClick(e) {
    e.stopPropagation();

    // Get recipients from the compose window
    const composeWindow = e.target.closest('div[role="dialog"], .nH .iN');
    const recipients = extractRecipients(composeWindow);

    // Open popup window for encryption
    const popupUrl = chrome.runtime.getURL('popup/popup.html');
    const popupWidth = 420;
    const popupHeight = 540;
    const left = Math.round((screen.width - popupWidth) / 2);
    const top = Math.round((screen.height - popupHeight) / 2);

    const popup = window.open(
      `${popupUrl}?recipients=${encodeURIComponent(recipients.join(','))}`,
      'seal-encrypt',
      `width=${popupWidth},height=${popupHeight},left=${left},top=${top},resizable=yes,scrollbars=yes`
    );

    if (!popup) {
      // Popup blocked - notify user
      showNotification('Please allow popups for Gmail to use Seal encryption.', 'error');
    }
  }

  /**
   * Extract recipient email addresses from compose window
   */
  function extractRecipients(composeWindow) {
    if (!composeWindow) return [];

    const recipients = new Set();

    // Gmail stores recipients in elements with email attribute or data-hovercard-id
    const recipientSelectors = [
      '[email]',
      '[data-hovercard-id]',
      'span[email]',
      '.afV span[email]',
      'div[data-hovercardid]'
    ];

    for (const selector of recipientSelectors) {
      const elements = composeWindow.querySelectorAll(selector);
      elements.forEach(el => {
        const email = el.getAttribute('email') ||
          el.getAttribute('data-hovercard-id') ||
          el.getAttribute('data-hovercardid') ||
          '';
        if (email && email.includes('@')) {
          recipients.add(email.toLowerCase());
        }
      });
    }

    return Array.from(recipients);
  }

  /**
   * Find Gmail compose toolbars and inject Seal button
   */
  function injectSealButtons() {
    // Gmail compose toolbar selectors (multiple strategies for compatibility)
    const toolbarSelectors = [
      // Standard compose toolbar with formatting options
      'div.btC',
      // Compose bottom area
      'tr.btC td.gU',
      // New Gmail compose toolbar
      'div[role="dialog"] div.bAK',
      // Toolbar area near send button
      'div.IZ',
      // Compose action bar
      'table.IZ',
      // Generic compose toolbar detection
      'div[role="dialog"] table.cf',
    ];

    for (const selector of toolbarSelectors) {
      const toolbars = document.querySelectorAll(selector);
      toolbars.forEach(toolbar => {
        // Check if we already injected into this compose window
        const composeRoot = toolbar.closest('div[role="dialog"]') ||
          toolbar.closest('.nH') ||
          toolbar;

        if (injectedComposeWindows.has(composeRoot)) return;

        // Check if seal button already exists in this toolbar
        if (toolbar.querySelector(`.${SEAL_BUTTON_CLASS}`)) return;

        const sealButton = createSealButton();
        toolbar.appendChild(sealButton);
        injectedComposeWindows.add(composeRoot);
      });
    }

    // Alternative: look for the attachment/insert area more broadly
    const composeDialogs = document.querySelectorAll('div[role="dialog"]');
    composeDialogs.forEach(dialog => {
      if (injectedComposeWindows.has(dialog)) return;

      // Look for the bottom toolbar area
      const bottomBar = dialog.querySelector('.bAK') ||
        dialog.querySelector('.btC') ||
        dialog.querySelector('td.gU');

      if (bottomBar && !bottomBar.querySelector(`.${SEAL_BUTTON_CLASS}`)) {
        const sealButton = createSealButton();
        bottomBar.appendChild(sealButton);
        injectedComposeWindows.add(dialog);
      }
    });
  }

  /**
   * Show a notification toast in Gmail
   */
  function showNotification(message, type = 'info') {
    const existing = document.querySelector('.seal-notification');
    if (existing) existing.remove();

    const notification = document.createElement('div');
    notification.className = `seal-notification seal-notification-${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.classList.add('seal-notification-hide');
      setTimeout(() => notification.remove(), 300);
    }, 4000);
  }

  /**
   * Attach a .seal file to the current Gmail compose draft
   */
  function attachToGmail(sealFileData, filename) {
    try {
      // Create blob from seal file data
      const jsonString = typeof sealFileData === 'string'
        ? sealFileData
        : JSON.stringify(sealFileData);
      const blob = new Blob([jsonString], { type: 'application/json' });
      const file = new File([blob], filename, { type: 'application/json' });

      // Strategy 1: Find Gmail's file input and inject
      const fileInputs = document.querySelectorAll('input[type="file"]');
      let attached = false;

      for (const fileInput of fileInputs) {
        try {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          fileInput.files = dataTransfer.files;
          fileInput.dispatchEvent(new Event('change', { bubbles: true }));
          attached = true;
          break;
        } catch (err) {
          // Try next input
        }
      }

      // Strategy 2: Drag and drop onto compose area
      if (!attached) {
        const composeBody = document.querySelector(
          'div[role="dialog"] div[contenteditable="true"]'
        );
        if (composeBody) {
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);

          const dropEvent = new DragEvent('drop', {
            bubbles: true,
            cancelable: true,
            dataTransfer
          });

          composeBody.dispatchEvent(dropEvent);
          attached = true;
        }
      }

      if (attached) {
        showNotification(`Sealed file "${filename}" attached successfully!`, 'success');
      } else {
        showNotification(
          'Could not auto-attach file. The file has been downloaded instead.',
          'warning'
        );
        // Fallback: download the file for manual attachment
        downloadFile(blob, filename);
      }
    } catch (err) {
      console.error('[Seal] Error attaching file:', err);
      showNotification('Error attaching sealed file. Please try again.', 'error');
    }
  }

  /**
   * Fallback: download file for manual attachment
   */
  function downloadFile(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Listen for messages from popup/background
   */
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'attachSealFile') {
      attachToGmail(request.sealFile, request.filename);
      sendResponse({ success: true });
    } else if (request.action === 'showNotification') {
      showNotification(request.message, request.type);
      sendResponse({ success: true });
    } else if (request.action === 'getRecipients') {
      // Get recipients from the most recent compose window
      const dialog = document.querySelector('div[role="dialog"]');
      const recipients = extractRecipients(dialog);
      sendResponse({ recipients });
    }
    return true;
  });

  /**
   * Observe DOM for new compose windows
   */
  function startObserver() {
    const observer = new MutationObserver((mutations) => {
      let shouldCheck = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          shouldCheck = true;
          break;
        }
      }
      if (shouldCheck) {
        // Debounce - Gmail can trigger many mutations
        clearTimeout(startObserver._timeout);
        startObserver._timeout = setTimeout(injectSealButtons, 300);
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Initialize
   */
  function init() {
    // Initial injection attempt
    injectSealButtons();

    // Watch for new compose windows
    startObserver();

    // Also poll periodically as a fallback
    setInterval(injectSealButtons, 2000);

    console.log('[Seal] Content script loaded');
  }

  // Wait for Gmail to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
