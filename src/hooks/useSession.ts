/**
 * Manages the decrypted private key in sessionStorage.
 * sessionStorage is automatically wiped when the browser tab/window is closed.
 */

import { useState, useCallback } from 'react'
import { importPrivateKeyFromBase64, arrayBufferToBase64 } from '../crypto/keys'

const SESSION_KEY = 'seal_private_key'
const SESSION_USER = 'seal_user_email'

export function useSession() {
  const [isUnlocked, setIsUnlocked] = useState<boolean>(() => {
    return sessionStorage.getItem(SESSION_KEY) !== null
  })

  const storePrivateKey = useCallback(async (privateKey: CryptoKey, userEmail: string) => {
    const pkcs8 = await crypto.subtle.exportKey('pkcs8', privateKey)
    sessionStorage.setItem(SESSION_KEY, arrayBufferToBase64(pkcs8))
    sessionStorage.setItem(SESSION_USER, userEmail)
    setIsUnlocked(true)
  }, [])

  const getPrivateKey = useCallback(async (): Promise<CryptoKey | null> => {
    const stored = sessionStorage.getItem(SESSION_KEY)
    if (!stored) return null
    try {
      return await importPrivateKeyFromBase64(stored)
    } catch {
      return null
    }
  }, [])

  const getStoredBase64 = useCallback((): string | null => {
    return sessionStorage.getItem(SESSION_KEY)
  }, [])

  const getSessionUser = useCallback((): string | null => {
    return sessionStorage.getItem(SESSION_USER)
  }, [])

  const clearSession = useCallback(() => {
    sessionStorage.removeItem(SESSION_KEY)
    sessionStorage.removeItem(SESSION_USER)
    setIsUnlocked(false)
  }, [])

  return {
    isUnlocked,
    storePrivateKey,
    getPrivateKey,
    getStoredBase64,
    getSessionUser,
    clearSession,
  }
}
