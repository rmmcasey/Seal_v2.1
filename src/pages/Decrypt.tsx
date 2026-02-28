import { useState } from 'react'
import { DropZone } from '../components/DropZone'
import { Button } from '../components/Button'
import { StatusMessage } from '../components/StatusMessage'
import { useCrypto } from '../hooks/useCrypto'
import { useSession } from '../hooks/useSession'
import { parseSealHeader } from '../crypto/seal'
import type { SealHeader } from '../crypto/seal'

type Step = 'idle' | 'parsing' | 'decrypting' | 'done' | 'error'

const PREVIEWABLE_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
  'text/plain', 'text/html', 'text/css', 'text/javascript',
  'application/pdf',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/wav', 'audio/ogg',
]

export function Decrypt() {
  const [sealFile, setSealFile] = useState<File | null>(null)
  const [header, setHeader] = useState<SealHeader | null>(null)
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState<string | null>(null)
  const [decryptedFile, setDecryptedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const { decrypt } = useCrypto()
  const { getSessionUser, isUnlocked } = useSession()

  const handleSealFile = async (file: File) => {
    setSealFile(file)
    setHeader(null)
    setError(null)
    setStep('parsing')

    try {
      const parsed = await parseSealHeader(file)
      setHeader(parsed)
      setStep('idle')
    } catch {
      setError('Could not read .seal file. Is it a valid Seal encrypted file?')
      setStep('error')
    }
  }

  const handleDecrypt = async () => {
    if (!sealFile) return
    setStep('decrypting')
    setError(null)

    try {
      const userEmail = getSessionUser()
      if (header && userEmail && header.recipientEmail.toLowerCase() !== userEmail.toLowerCase()) {
        throw new Error(
          `This file is encrypted for ${header.recipientEmail}, but you are signed in as ${userEmail}.`
        )
      }

      const { file } = await decrypt(sealFile)
      setDecryptedFile(file)

      if (PREVIEWABLE_TYPES.includes(file.type)) {
        const url = URL.createObjectURL(file)
        setPreviewUrl(url)
      }

      setStep('done')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Decryption failed. Wrong file or session expired.')
      setStep('error')
    }
  }

  const handleDownload = () => {
    if (!decryptedFile) return
    const url = URL.createObjectURL(decryptedFile)
    const a = document.createElement('a')
    a.href = url
    a.download = decryptedFile.name
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleReset = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl)
    setSealFile(null)
    setHeader(null)
    setStep('idle')
    setError(null)
    setDecryptedFile(null)
    setPreviewUrl(null)
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-1">Decrypt a file</h1>
        <p className="text-sm text-gray-500">
          Drop a <code className="text-gray-300 text-xs bg-white/5 px-1 py-0.5 rounded">.seal</code> file to decrypt it with your private key.
        </p>
      </div>

      {!isUnlocked && (
        <StatusMessage
          type="warning"
          message="Your private key is not loaded. Sign out and sign back in to unlock your session."
        />
      )}

      {step === 'done' && decryptedFile ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-6 py-5 flex flex-col gap-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center flex-shrink-0">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white">Decrypted successfully</p>
                <p className="text-xs text-gray-500 mt-0.5 truncate">{decryptedFile.name}</p>
                <p className="text-xs text-gray-600">{formatSize(decryptedFile.size)}</p>
              </div>
            </div>

            {header && (
              <div className="border-t border-white/5 pt-3 grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-gray-600">From</span>
                  <p className="text-gray-300 truncate">{header.senderEmail || '—'}</p>
                </div>
                <div>
                  <span className="text-gray-600">For</span>
                  <p className="text-gray-300 truncate">{header.recipientEmail}</p>
                </div>
              </div>
            )}
          </div>

          {/* Preview */}
          {previewUrl && decryptedFile.type.startsWith('image/') && (
            <div className="rounded-xl overflow-hidden border border-white/10">
              <img src={previewUrl} alt={decryptedFile.name} className="w-full max-h-80 object-contain bg-black" />
            </div>
          )}
          {previewUrl && decryptedFile.type === 'application/pdf' && (
            <iframe src={previewUrl} className="w-full h-80 rounded-xl border border-white/10" title="PDF Preview" />
          )}
          {previewUrl && decryptedFile.type.startsWith('video/') && (
            <video src={previewUrl} controls className="w-full rounded-xl border border-white/10 max-h-64" />
          )}
          {previewUrl && decryptedFile.type.startsWith('audio/') && (
            <audio src={previewUrl} controls className="w-full" />
          )}

          <Button onClick={handleDownload} size="lg" className="w-full">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Save {decryptedFile.name}
          </Button>

          <Button onClick={handleReset} variant="ghost" className="w-full">
            Decrypt another file
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <DropZone
            accept=".seal"
            onFile={handleSealFile}
            file={sealFile}
            label="Drop a .seal file here"
            sublabel="Only .seal encrypted files"
            disabled={step === 'decrypting'}
          />

          {/* Header preview */}
          {header && step !== 'error' && (
            <div className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-3 text-xs flex flex-col gap-2">
              <p className="text-gray-600 uppercase tracking-wider font-medium">File info</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-gray-600">Recipient</span>
                  <p className="text-gray-300 truncate">{header.recipientEmail}</p>
                </div>
                <div>
                  <span className="text-gray-600">From</span>
                  <p className="text-gray-300 truncate">{header.senderEmail || '—'}</p>
                </div>
                <div>
                  <span className="text-gray-600">Original file</span>
                  <p className="text-gray-300 truncate">{header.originalFileName}</p>
                </div>
                <div>
                  <span className="text-gray-600">Type</span>
                  <p className="text-gray-300">{header.originalMimeType}</p>
                </div>
              </div>
            </div>
          )}

          {error && <StatusMessage type="error" message={error} />}

          <Button
            onClick={handleDecrypt}
            loading={step === 'decrypting'}
            disabled={!sealFile || !isUnlocked || step === 'parsing' || step === 'error'}
            size="lg"
            className="w-full"
          >
            {step === 'decrypting' ? 'Decrypting…' : 'Decrypt file'}
          </Button>
        </div>
      )}
    </div>
  )
}
