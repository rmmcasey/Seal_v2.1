import { useState, useEffect, useCallback } from 'react'
import type { User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import type { Profile } from '../lib/supabase'
import {
  generateRSAKeyPair,
  exportPublicKeyToBase64,
  encryptPrivateKey,
  decryptPrivateKey,
  generateSalt,
  arrayBufferToBase64,
} from '../crypto/keys'
import type { EncryptedKeyBlob } from '../crypto/keys'
import { useSession } from './useSession'

export type AuthState =
  | { status: 'loading' }
  | { status: 'unauthenticated' }
  | { status: 'needs_key_setup'; user: User }
  | { status: 'authenticated'; user: User; profile: Profile }

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({ status: 'loading' })
  const { storePrivateKey, clearSession } = useSession()

  useEffect(() => {
    const init = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        await resolveUserProfile(session.user)
      } else {
        setAuthState({ status: 'unauthenticated' })
      }
    }
    init()

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await resolveUserProfile(session.user)
      } else {
        clearSession()
        setAuthState({ status: 'unauthenticated' })
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  async function resolveUserProfile(user: User) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single()

    if (!profile || !profile.encrypted_private_key_blob) {
      setAuthState({ status: 'needs_key_setup', user })
    } else {
      setAuthState({ status: 'authenticated', user, profile })
    }
  }

  const signUp = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    return data
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error

    // After sign in, fetch profile and decrypt private key in one step
    if (data.user) {
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()

      if (profileError || !profile?.encrypted_private_key_blob) {
        setAuthState({ status: 'needs_key_setup', user: data.user })
        return
      }

      // Decrypt private key using login password
      const blob: EncryptedKeyBlob = JSON.parse(profile.encrypted_private_key_blob)
      const privateKey = await decryptPrivateKey(blob, password)
      await storePrivateKey(privateKey, email)
      setAuthState({ status: 'authenticated', user: data.user, profile })
    }
  }, [storePrivateKey])

  const setupKeys = useCallback(async (
    user: User,
    password: string
  ): Promise<{ backupBlob: Blob; backupFileName: string }> => {
    // Generate RSA key pair
    const keyPair = await generateRSAKeyPair()
    const publicKeyBase64 = await exportPublicKeyToBase64(keyPair.publicKey)

    // Encrypt private key with the user's password
    const salt = generateSalt()
    const encryptedBlob = await encryptPrivateKey(keyPair.privateKey, password, salt)

    // Upload to Supabase
    const { error } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email!,
      public_key: publicKeyBase64,
      encrypted_private_key_blob: JSON.stringify(encryptedBlob),
      salt: arrayBufferToBase64(salt.buffer as ArrayBuffer),
    })

    if (error) throw error

    // Store private key in session
    await storePrivateKey(keyPair.privateKey, user.email!)

    // Create .sealkey backup file
    const backupPayload = JSON.stringify({
      email: user.email,
      encryptedBlob,
      exportedAt: new Date().toISOString(),
    }, null, 2)

    const backupBlob = new Blob([backupPayload], { type: 'application/json' })
    const backupFileName = `seal-backup-${user.email!.replace('@', '-at-')}.sealkey`

    return { backupBlob, backupFileName }
  }, [storePrivateKey])

  const recoverFromBackup = useCallback(async (
    backupFile: File,
    password: string
  ): Promise<void> => {
    const text = await backupFile.text()
    const payload = JSON.parse(text)
    const blob: EncryptedKeyBlob = payload.encryptedBlob

    const privateKey = await decryptPrivateKey(blob, password)

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) throw new Error('Not authenticated')

    // Re-upload to Supabase if needed
    await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email!,
      encrypted_private_key_blob: JSON.stringify(blob),
      salt: blob.salt,
    })

    await storePrivateKey(privateKey, user.email!)
  }, [storePrivateKey])

  const signOut = useCallback(async () => {
    await supabase.auth.signOut()
    clearSession()
  }, [clearSession])

  return {
    authState,
    signUp,
    signIn,
    setupKeys,
    recoverFromBackup,
    signOut,
  }
}
