/**
 * High-level hook wrapping all encrypt/decrypt operations.
 */

import { useCallback } from 'react'
import { importPublicKeyFromBase64 } from '../crypto/keys'
import { encryptFile, decryptSealFile } from '../crypto/seal'
import type { SealHeader } from '../crypto/seal'
import { useSession } from './useSession'

export function useCrypto() {
  const { getPrivateKey } = useSession()

  const encrypt = useCallback(async (
    file: File,
    recipientPublicKeyBase64: string,
    senderEmail: string,
    recipientEmail: string
  ): Promise<Blob> => {
    const recipientPublicKey = await importPublicKeyFromBase64(recipientPublicKeyBase64)
    return encryptFile(file, recipientPublicKey, senderEmail, recipientEmail)
  }, [])

  const decrypt = useCallback(async (
    sealBlob: Blob
  ): Promise<{ file: File; header: SealHeader }> => {
    const privateKey = await getPrivateKey()
    if (!privateKey) {
      throw new Error('Session expired. Please log in again to unlock your private key.')
    }
    return decryptSealFile(sealBlob, privateKey)
  }, [getPrivateKey])

  return { encrypt, decrypt }
}
