/**
 * Seal Gmail Content Script
 *
 * Injects an "Encrypt with Seal" button into Gmail's compose toolbar.
 * When clicked, it intercepts the attached file, encrypts it locally
 * using the recipient's Seal public key, and replaces the attachment.
 */

const SEAL_APP_URL = 'https://seal.vercel.app' // Update with your deployed URL
const SUPABASE_URL = 'YOUR_SUPABASE_URL'        // Set during build
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY' // Set during build

// ─── Utilities ────────────────────────────────────────────────────────────────

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

function base64ToArrayBuffer(base64) {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes.buffer
}

// ─── Crypto (mirrors web app logic) ──────────────────────────────────────────

async function importPublicKey(base64) {
  const spki = base64ToArrayBuffer(base64)
  return crypto.subtle.importKey(
    'spki', spki,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false, ['wrapKey']
  )
}

async function encryptFileForRecipient(file, recipientPublicKeyBase64, senderEmail, recipientEmail) {
  const publicKey = await importPublicKey(recipientPublicKeyBase64)
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const fileBuffer = await file.arrayBuffer()
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, fileBuffer)
  const wrappedKey = await crypto.subtle.wrapKey('raw', aesKey, publicKey, { name: 'RSA-OAEP' })

  const header = JSON.stringify({
    version: '1',
    recipientEmail,
    senderEmail,
    originalFileName: file.name,
    originalMimeType: file.type || 'application/octet-stream',
    wrappedAesKey: arrayBufferToBase64(wrappedKey),
    iv: arrayBufferToBase64(iv),
  }) + '\n'

  const headerBytes = new TextEncoder().encode(header)
  const encryptedBytes = new Uint8Array(encrypted)
  const combined = new Uint8Array(headerBytes.length + encryptedBytes.length)
  combined.set(headerBytes)
  combined.set(encryptedBytes, headerBytes.length)

  return new Blob([combined], { type: 'application/octet-stream' })
}

// ─── Supabase API ─────────────────────────────────────────────────────────────

async function fetchRecipientPublicKey(email) {
  const session = await getStoredSession()
  if (!session) throw new Error('Not signed in to Seal')

  const url = `${SUPABASE_URL}/rest/v1/profiles?email=eq.${encodeURIComponent(email)}&select=email,public_key`
  const res = await fetch(url, {
    headers: {
      'apikey': SUPABASE_ANON_KEY,
      'Authorization': `Bearer ${session.access_token}`,
    }
  })
  const data = await res.json()
  if (!data || data.length === 0) throw new Error(`No Seal account found for ${email}`)
  if (!data[0].public_key) throw new Error(`${email} hasn't set up their Seal keys yet`)
  return data[0]
}

async function getStoredSession() {
  return new Promise((resolve) => {
    // Look for Supabase session in extension storage (synced from web app via shared origin)
    chrome.storage.local.get(['supabase_session'], (result) => {
      resolve(result.supabase_session || null)
    })
  })
}

// ─── Gmail Integration ────────────────────────────────────────────────────────

/**
 * Extract the "To:" email from the compose window.
 */
function getRecipientEmailFromCompose(composeEl) {
  // Gmail stores recipient chips in aria-label attributes
  const chips = composeEl.querySelectorAll('[data-hovercard-id]')
  if (chips.length > 0) {
    return chips[0].getAttribute('data-hovercard-id')
  }
  // Fallback: read the To input field
  const toInput = composeEl.querySelector('input[name="to"]') ||
    composeEl.querySelector('[aria-label="To recipients"]')
  return toInput?.value?.trim() || null
}

/**
 * Create the "Encrypt with Seal" button and inject into the compose toolbar.
 */
function injectEncryptButton(composeEl) {
  if (composeEl.querySelector('[data-seal-btn]')) return // Already injected

  const toolbar = composeEl.querySelector('.btC') || composeEl.querySelector('[role="toolbar"]')
  if (!toolbar) return

  const btn = document.createElement('button')
  btn.setAttribute('data-seal-btn', 'true')
  btn.setAttribute('title', 'Encrypt attachment with Seal')
  btn.setAttribute('type', 'button')
  btn.style.cssText = `
    display: inline-flex; align-items: center; gap: 5px;
    padding: 6px 10px; margin-left: 6px;
    background: #ffffff14; border: 1px solid #ffffff28;
    border-radius: 6px; color: white; font-size: 12px;
    cursor: pointer; font-family: inherit;
    transition: background 150ms ease;
  `
  btn.innerHTML = `
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
    Encrypt with Seal
  `

  btn.addEventListener('mouseenter', () => btn.style.background = '#ffffff24')
  btn.addEventListener('mouseleave', () => btn.style.background = '#ffffff14')

  btn.addEventListener('click', async (e) => {
    e.preventDefault()
    e.stopPropagation()
    await handleEncryptClick(composeEl, btn)
  })

  toolbar.appendChild(btn)
}

async function handleEncryptClick(composeEl, btn) {
  const session = await getStoredSession()
  if (!session) {
    const open = confirm(
      'You need to be signed in to Seal to encrypt files.\n\nClick OK to open the Seal app.'
    )
    if (open) window.open(SEAL_APP_URL, '_blank')
    return
  }

  // Check for file input / attachment
  const fileInput = document.createElement('input')
  fileInput.type = 'file'
  fileInput.style.display = 'none'
  document.body.appendChild(fileInput)

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0]
    document.body.removeChild(fileInput)
    if (!file) return

    const recipientEmail = getRecipientEmailFromCompose(composeEl)
    if (!recipientEmail) {
      alert('Please add a recipient in the To field before encrypting.')
      return
    }

    btn.textContent = 'Encrypting…'
    btn.disabled = true

    try {
      const { public_key } = await fetchRecipientPublicKey(recipientEmail)
      const senderEmail = session.user?.email || ''

      const encryptedBlob = await encryptFileForRecipient(file, public_key, senderEmail, recipientEmail)
      const encryptedFile = new File([encryptedBlob], `${file.name}.seal`, {
        type: 'application/octet-stream'
      })

      // Trigger Gmail's file attachment with the encrypted file
      simulateGmailAttachment(composeEl, encryptedFile)

      btn.textContent = '✓ Encrypted'
      btn.style.borderColor = '#4ade8044'
      btn.style.color = '#4ade80'
    } catch (err) {
      alert(`Encryption failed: ${err.message}`)
      btn.innerHTML = `<span style="color:#f87171">✗ Failed</span>`
    } finally {
      btn.disabled = false
    }
  })

  fileInput.click()
}

/**
 * Simulate dropping the encrypted file into Gmail's attachment zone.
 */
function simulateGmailAttachment(composeEl, file) {
  const dt = new DataTransfer()
  dt.items.add(file)

  const dropZone = composeEl.querySelector('[data-tooltip="Attach files"]')?.closest('form') ||
    composeEl

  const dropEvent = new DragEvent('drop', {
    bubbles: true,
    cancelable: true,
    dataTransfer: dt,
  })
  dropZone.dispatchEvent(dropEvent)
}

// ─── Observer ─────────────────────────────────────────────────────────────────

/**
 * Watch for new compose windows appearing in the DOM.
 */
function observeComposeWindows() {
  const observer = new MutationObserver(() => {
    document.querySelectorAll('.nH.Hd[role="dialog"], .aaZ').forEach(composeEl => {
      if (!composeEl.querySelector('[data-seal-btn]')) {
        // Small delay to let Gmail finish rendering its toolbar
        setTimeout(() => injectEncryptButton(composeEl), 400)
      }
    })
  })

  observer.observe(document.body, { childList: true, subtree: true })
}

// ─── Init ─────────────────────────────────────────────────────────────────────

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', observeComposeWindows)
} else {
  observeComposeWindows()
}
