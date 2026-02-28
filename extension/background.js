/**
 * Seal Extension — Background Service Worker
 *
 * Handles session sync between the Seal web app and the extension.
 * The web app writes the Supabase session to chrome.storage.local when the
 * extension is installed, so the content script can use it to authenticate
 * API calls without re-login.
 */

// Listen for messages from the Seal web app (sent via postMessage → content script → background)
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'SEAL_SESSION_UPDATE') {
    chrome.storage.local.set({ supabase_session: message.session }, () => {
      sendResponse({ ok: true })
    })
    return true // Keep channel open for async response
  }

  if (message.type === 'SEAL_SESSION_CLEAR') {
    chrome.storage.local.remove('supabase_session', () => {
      sendResponse({ ok: true })
    })
    return true
  }

  if (message.type === 'SEAL_GET_SESSION') {
    chrome.storage.local.get(['supabase_session'], (result) => {
      sendResponse({ session: result.supabase_session || null })
    })
    return true
  }
})

// When the extension is installed or updated, open the Seal web app
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === 'install') {
    chrome.tabs.create({ url: 'https://seal.vercel.app' })
  }
})
