import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './hooks/useAuth'
import { AuthPage } from './pages/AuthPage'
import { KeySetupPage } from './pages/KeySetupPage'
import { Layout } from './components/Layout'
import { Encrypt } from './pages/Encrypt'
import { Decrypt } from './pages/Decrypt'
import { Contacts } from './pages/Contacts'

export function App() {
  const { authState } = useAuth()

  if (authState.status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#0a0a0a' }}>
        <div className="flex flex-col items-center gap-4">
          <svg className="animate-spin w-6 h-6 text-gray-500" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-xs text-gray-600">Loading Seal…</p>
        </div>
      </div>
    )
  }

  if (authState.status === 'unauthenticated') {
    return <AuthPage />
  }

  if (authState.status === 'needs_key_setup') {
    return <KeySetupPage user={authState.user} />
  }

  // Authenticated
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/encrypt" replace />} />
          <Route path="/encrypt" element={<Encrypt />} />
          <Route path="/decrypt" element={<Decrypt />} />
          <Route path="/contacts" element={<Contacts />} />
          <Route path="*" element={<Navigate to="/encrypt" replace />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  )
}
