import { type ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Logo } from './Logo'
import { SessionBadge } from './SessionBadge'
import { useAuth } from '../hooks/useAuth'

interface LayoutProps {
  children: ReactNode
}

const navItems = [
  { to: '/encrypt', label: 'Encrypt', icon: LockIcon },
  { to: '/decrypt', label: 'Decrypt', icon: UnlockIcon },
  { to: '/contacts', label: 'Contacts', icon: ContactsIcon },
]

export function Layout({ children }: LayoutProps) {
  const { signOut } = useAuth()

  return (
    <div className="min-h-screen flex flex-col" style={{ background: '#0a0a0a' }}>
      {/* Header */}
      <header className="border-b border-white/[0.06] px-6 py-4">
        <div className="max-w-5xl mx-auto flex items-center justify-between">
          {/* Logo + Nav */}
          <div className="flex items-center gap-8">
            <div className="flex items-center gap-2.5">
              <Logo size={24} />
              <span className="text-base font-semibold tracking-tight">Seal</span>
            </div>

            <nav className="flex items-center gap-1">
              {navItems.map(({ to, label, icon: Icon }) => (
                <NavLink
                  key={to}
                  to={to}
                  className={({ isActive }) =>
                    `flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-all duration-150
                    ${isActive
                      ? 'bg-white/10 text-white font-medium'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
                    }`
                  }
                >
                  <Icon />
                  {label}
                </NavLink>
              ))}
            </nav>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-4">
            <SessionBadge />
            <button
              onClick={signOut}
              className="text-xs text-gray-600 hover:text-gray-400 transition-colors"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 px-6 py-10">
        <div className="max-w-5xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  )
}

function LockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function UnlockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 9.9-1" />
    </svg>
  )
}

function ContactsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  )
}
