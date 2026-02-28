/**
 * Extension Bridge
 *
 * When the user is signed in, posts the Supabase session to the Chrome extension
 * via window.postMessage. The extension's content script relays it to the
 * background service worker which stores it in chrome.storage.local.
 *
 * This allows the Gmail extension to authenticate Supabase API calls without
 * requiring a separate login.
 */

import { supabase } from './supabase'

export function initExtensionBridge() {
  // Send session to extension whenever auth state changes
  supabase.auth.onAuthStateChange((_event, session) => {
    if (session) {
      window.postMessage({ type: 'SEAL_SESSION_UPDATE', session }, '*')
    } else {
      window.postMessage({ type: 'SEAL_SESSION_CLEAR' }, '*')
    }
  })
}
