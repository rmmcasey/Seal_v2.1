import { useState } from 'react'
import { DropZone } from '../components/DropZone'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { StatusMessage } from '../components/StatusMessage'
import { useCrypto } from '../hooks/useCrypto'
import { useSession } from '../hooks/useSession'
import { supabase } from '../lib/supabase'

type Step = 'idle' | 'encrypting' | 'done' | 'error'

export function Encrypt() {
  const [file, setFile] = useState<File | null>(null)
  const [recipientEmail, setRecipientEmail] = useState('')
  const [step, setStep] = useState<Step>('idle')
  const [error, setError] = useState<string | null>(null)
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null)
  const [outputFileName, setOutputFileName] = useState('')

  const { encrypt } = useCrypto()
  const { getSessionUser } = useSession()

  const handleEncrypt = async () => {
    if (!file || !recipientEmail) return
    setStep('encrypting')
    setError(null)

    try {
      const senderEmail = getSessionUser() || ''

      // Fetch recipient's public key
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('public_key, email')
        .eq('email', recipientEmail.trim().toLowerCase())
        .single()

      if (profileError || !profile) {
        throw new Error(`No Seal account found for ${recipientEmail}. Ask them to sign up first.`)
      }
      if (!profile.public_key) {
        throw new Error(`Recipient hasn't set up their encryption keys yet.`)
      }

      const encryptedBlob = await encrypt(file, profile.public_key, senderEmail, profile.email)

      const outName = `${file.name}.seal`
      setOutputBlob(encryptedBlob)
      setOutputFileName(outName)
      setStep('done')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Encryption failed')
      setStep('error')
    }
  }

  const handleDownload = () => {
    if (!outputBlob) return
    const url = URL.createObjectURL(outputBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = outputFileName
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleReset = () => {
    setFile(null)
    setRecipientEmail('')
    setStep('idle')
    setError(null)
    setOutputBlob(null)
    setOutputFileName('')
  }

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-1">Encrypt a file</h1>
        <p className="text-sm text-gray-500">
          Encrypt any file for a recipient. The file is encrypted locally — nothing is uploaded.
        </p>
      </div>

      {step === 'done' ? (
        <div className="flex flex-col gap-4">
          <div className="rounded-xl border border-green-500/20 bg-green-500/5 px-6 py-6 flex flex-col items-center gap-4 text-center">
            <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-green-400">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-white">File encrypted successfully</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {outputFileName} is ready to send to {recipientEmail}
              </p>
            </div>
            <Button onClick={handleDownload} size="lg" className="w-full">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              Download {outputFileName}
            </Button>
          </div>
          <p className="text-xs text-gray-600 text-center">
            Send this .seal file to {recipientEmail} through any channel — email, Slack, etc.
          </p>
          <Button onClick={handleReset} variant="ghost" className="w-full">
            Encrypt another file
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <DropZone
            onFile={setFile}
            file={file}
            label="Drop any file here"
            sublabel="Any file type supported"
            disabled={step === 'encrypting'}
          />

          <Input
            label="Recipient email"
            type="email"
            placeholder="recipient@example.com"
            value={recipientEmail}
            onChange={e => setRecipientEmail(e.target.value)}
            disabled={step === 'encrypting'}
          />

          {error && <StatusMessage type="error" message={error} />}

          <Button
            onClick={handleEncrypt}
            loading={step === 'encrypting'}
            disabled={!file || !recipientEmail}
            size="lg"
            className="w-full"
          >
            {step === 'encrypting' ? 'Encrypting…' : 'Encrypt file'}
          </Button>

          {step === 'encrypting' && (
            <p className="text-xs text-gray-600 text-center">
              Generating AES key, encrypting file, wrapping key with recipient's public key…
            </p>
          )}
        </div>
      )}
    </div>
  )
}
