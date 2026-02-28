import { useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { Logo } from '../components/Logo'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { StatusMessage } from '../components/StatusMessage'
import { useAuth } from '../hooks/useAuth'

interface KeySetupPageProps {
  user: User
}

export function KeySetupPage({ user }: KeySetupPageProps) {
  const [step, setStep] = useState<'generate' | 'backup' | 'recover'>('generate')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [backupBlob, setBackupBlob] = useState<Blob | null>(null)
  const [backupFileName, setBackupFileName] = useState('')
  const [downloaded, setDownloaded] = useState(false)
  const [recoveryFile, setRecoveryFile] = useState<File | null>(null)

  const { setupKeys, recoverFromBackup, signOut } = useAuth()

  const handleGenerate = async () => {
    if (!password || password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }
    setError(null)
    setLoading(true)
    try {
      const { backupBlob: blob, backupFileName: fileName } = await setupKeys(user, password)
      setBackupBlob(blob)
      setBackupFileName(fileName)
      setStep('backup')
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Key generation failed')
    } finally {
      setLoading(false)
    }
  }

  const handleDownloadBackup = () => {
    if (!backupBlob) return
    const url = URL.createObjectURL(backupBlob)
    const a = document.createElement('a')
    a.href = url
    a.download = backupFileName
    a.click()
    URL.revokeObjectURL(url)
    setDownloaded(true)
  }

  const handleRecover = async () => {
    if (!recoveryFile || !password) {
      setError('Please select your .sealkey file and enter your password')
      return
    }
    setError(null)
    setLoading(true)
    try {
      await recoverFromBackup(recoveryFile, password)
    } catch {
      setError('Recovery failed. Check that you selected the right file and entered the correct password.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0a0a0a' }}>
      <div className="w-full max-w-md">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Logo size={28} />
            <span className="text-lg font-semibold">Seal</span>
          </div>
          <button onClick={signOut} className="text-xs text-gray-500 hover:text-gray-300 transition-colors">
            Sign out
          </button>
        </div>

        {step === 'generate' && (
          <div>
            <h1 className="text-xl font-semibold mb-2">Set up your encryption keys</h1>
            <p className="text-sm text-gray-400 mb-6">
              Seal generates a unique RSA key pair for you. Your private key is encrypted with your password
              and stored securely — we never see it.
            </p>

            <div className="flex flex-col gap-4">
              <Input
                label="Confirm your password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
                autoComplete="current-password"
              />

              {error && <StatusMessage type="error" message={error} />}

              <Button onClick={handleGenerate} loading={loading} size="lg" className="w-full">
                Generate encryption keys
              </Button>

              <button
                onClick={() => setStep('recover')}
                className="text-xs text-gray-500 hover:text-gray-300 text-center transition-colors"
              >
                Already have a .sealkey backup file? Recover instead
              </button>
            </div>
          </div>
        )}

        {step === 'backup' && (
          <div>
            <div className="w-12 h-12 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center mb-4">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-yellow-400">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>

            <h1 className="text-xl font-semibold mb-2">Download your backup key</h1>
            <p className="text-sm text-gray-400 mb-1">
              This <strong className="text-white">.sealkey</strong> file is your only recovery option if you lose access.
              Store it somewhere safe — a password manager, encrypted drive, or offline backup.
            </p>
            <p className="text-xs text-red-400 mb-6">
              Without this file and your password, files encrypted for you are permanently unrecoverable.
            </p>

            <div className="flex flex-col gap-3">
              <Button onClick={handleDownloadBackup} variant="secondary" size="lg" className="w-full">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                Download {backupFileName}
              </Button>

              <Button
                onClick={() => {/* navigation handled by auth state */ window.location.reload()}}
                size="lg"
                className="w-full"
                disabled={!downloaded}
              >
                I've saved my backup — continue
              </Button>

              {!downloaded && (
                <p className="text-xs text-gray-600 text-center">
                  You must download the backup file before continuing
                </p>
              )}
            </div>
          </div>
        )}

        {step === 'recover' && (
          <div>
            <h1 className="text-xl font-semibold mb-2">Recover from backup</h1>
            <p className="text-sm text-gray-400 mb-6">
              Upload your <strong className="text-white">.sealkey</strong> backup file and enter the password
              you used when you created your account.
            </p>

            <div className="flex flex-col gap-4">
              <div>
                <label className="text-xs font-medium text-gray-400 uppercase tracking-wider block mb-1.5">
                  Backup file (.sealkey)
                </label>
                <input
                  type="file"
                  accept=".sealkey,.json"
                  onChange={e => setRecoveryFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-gray-400 bg-white/5 border border-white/10 rounded-lg px-3 py-2.5
                    file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs
                    file:bg-white/10 file:text-white hover:file:bg-white/20 transition-all"
                />
              </div>

              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />

              {error && <StatusMessage type="error" message={error} />}

              <Button onClick={handleRecover} loading={loading} size="lg" className="w-full">
                Recover access
              </Button>

              <button
                onClick={() => setStep('generate')}
                className="text-xs text-gray-500 hover:text-gray-300 text-center transition-colors"
              >
                ← Generate new keys instead
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
