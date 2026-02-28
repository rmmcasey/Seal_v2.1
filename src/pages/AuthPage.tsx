import { useState, type FormEvent } from 'react'
import { Logo } from '../components/Logo'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { StatusMessage } from '../components/StatusMessage'
import { useAuth } from '../hooks/useAuth'

export function AuthPage() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)

  const { signIn, signUp } = useAuth()

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setInfo(null)
    setLoading(true)

    try {
      if (mode === 'signup') {
        await signUp(email, password)
        setInfo('Check your email to confirm your account, then sign in.')
        setMode('signin')
      } else {
        await signIn(email, password)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: '#0a0a0a' }}>
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="flex flex-col items-center mb-10">
          <div className="flex items-center gap-3 mb-3">
            <Logo size={36} />
            <span className="text-2xl font-semibold tracking-tight">Seal</span>
          </div>
          <p className="text-sm text-gray-500 text-center">
            End-to-end encrypted file transfer.<br />Your files never touch our servers.
          </p>
        </div>

        {/* Tab switcher */}
        <div className="flex bg-white/5 rounded-lg p-1 mb-6">
          <button
            onClick={() => setMode('signin')}
            className={`flex-1 text-sm py-1.5 rounded-md transition-all duration-150 font-medium
              ${mode === 'signin' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
          >
            Sign in
          </button>
          <button
            onClick={() => setMode('signup')}
            className={`flex-1 text-sm py-1.5 rounded-md transition-all duration-150 font-medium
              ${mode === 'signup' ? 'bg-white text-black' : 'text-gray-400 hover:text-white'}`}
          >
            Create account
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <Input
            label="Password"
            type="password"
            placeholder="••••••••"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
            minLength={8}
          />

          {mode === 'signup' && (
            <p className="text-xs text-gray-500 bg-white/[0.03] border border-white/5 rounded-lg px-3 py-2.5">
              After signing up, you'll generate an encryption key pair. You'll be required to download a backup file —
              <strong className="text-gray-300"> keep it safe</strong>. Without it and your password, encrypted files are unrecoverable.
            </p>
          )}

          {error && <StatusMessage type="error" message={error} />}
          {info && <StatusMessage type="info" message={info} />}

          <Button type="submit" loading={loading} size="lg" className="mt-2 w-full">
            {mode === 'signup' ? 'Create account' : 'Sign in'}
          </Button>
        </form>
      </div>
    </div>
  )
}
