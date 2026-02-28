import { useState, useEffect } from 'react'
import { Button } from '../components/Button'
import { Input } from '../components/Input'
import { StatusMessage } from '../components/StatusMessage'
import { supabase } from '../lib/supabase'
import type { Contact } from '../lib/supabase'
import { getPublicKeyFingerprint } from '../crypto/keys'
import { useSession } from '../hooks/useSession'

export function Contacts() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [searchEmail, setSearchEmail] = useState('')
  const [searchResult, setSearchResult] = useState<{ email: string; public_key: string } | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [addingContact, setAddingContact] = useState(false)
  const [loadingContacts, setLoadingContacts] = useState(true)
  const [fingerprints, setFingerprints] = useState<Record<string, string>>({})

  const { getSessionUser } = useSession()

  useEffect(() => {
    loadContacts()
  }, [])

  const loadContacts = async () => {
    setLoadingContacts(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data } = await supabase
      .from('contacts')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    const list = data || []
    setContacts(list)

    // Load fingerprints
    const fps: Record<string, string> = {}
    await Promise.all(
      list.map(async (c) => {
        if (c.contact_public_key) {
          fps[c.id] = await getPublicKeyFingerprint(c.contact_public_key)
        }
      })
    )
    setFingerprints(fps)
    setLoadingContacts(false)
  }

  const handleSearch = async () => {
    setSearchResult(null)
    setSearchError(null)
    setSearching(true)

    try {
      const normalizedEmail = searchEmail.trim().toLowerCase()
      const userEmail = getSessionUser()

      if (normalizedEmail === userEmail) {
        setSearchError("That's your own email address.")
        setSearching(false)
        return
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('email, public_key')
        .eq('email', normalizedEmail)
        .single()

      if (error || !data) {
        setSearchError(`No Seal account found for ${searchEmail}`)
      } else if (!data.public_key) {
        setSearchError(`${searchEmail} hasn't set up their encryption keys yet.`)
      } else {
        setSearchResult(data)
      }
    } catch {
      setSearchError('Search failed. Try again.')
    } finally {
      setSearching(false)
    }
  }

  const handleAddContact = async () => {
    if (!searchResult) return
    setAddingContact(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const { error } = await supabase.from('contacts').upsert({
        user_id: user.id,
        contact_email: searchResult.email,
        contact_public_key: searchResult.public_key,
      }, { onConflict: 'user_id,contact_email' })

      if (error) throw error

      setSearchResult(null)
      setSearchEmail('')
      await loadContacts()
    } catch (err: unknown) {
      setSearchError(err instanceof Error ? err.message : 'Failed to add contact')
    } finally {
      setAddingContact(false)
    }
  }

  const handleRemoveContact = async (contactId: string) => {
    await supabase.from('contacts').delete().eq('id', contactId)
    setContacts(prev => prev.filter(c => c.id !== contactId))
  }

  const isAlreadyContact = searchResult
    ? contacts.some(c => c.contact_email === searchResult.email)
    : false

  return (
    <div className="max-w-lg mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold mb-1">Contacts</h1>
        <p className="text-sm text-gray-500">
          Find other Seal users and save them as contacts for quick encryption.
        </p>
      </div>

      {/* Search */}
      <div className="mb-8">
        <div className="flex gap-2 mb-3">
          <Input
            placeholder="Search by email address…"
            type="email"
            value={searchEmail}
            onChange={e => setSearchEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="flex-1"
          />
          <Button
            onClick={handleSearch}
            loading={searching}
            disabled={!searchEmail.trim()}
            variant="secondary"
          >
            Search
          </Button>
        </div>

        {searchError && <StatusMessage type="error" message={searchError} />}

        {searchResult && (
          <div className="rounded-lg border border-white/10 bg-white/[0.02] px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{searchResult.email}</p>
                <p className="text-xs text-gray-600 mt-0.5 font-mono truncate">
                  {/* Show key fingerprint inline */}
                  <FingerprintDisplay publicKey={searchResult.public_key} />
                </p>
              </div>
              {isAlreadyContact ? (
                <span className="text-xs text-gray-500 flex-shrink-0 py-1">Already saved</span>
              ) : (
                <Button
                  onClick={handleAddContact}
                  loading={addingContact}
                  size="sm"
                  variant="secondary"
                  className="flex-shrink-0"
                >
                  Add contact
                </Button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Contacts list */}
      <div>
        <h2 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-3">
          Saved contacts {contacts.length > 0 && `· ${contacts.length}`}
        </h2>

        {loadingContacts ? (
          <div className="text-sm text-gray-600">Loading…</div>
        ) : contacts.length === 0 ? (
          <div className="text-center py-12 text-gray-600 text-sm">
            No contacts yet. Search for a Seal user above to add them.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {contacts.map(contact => (
              <div
                key={contact.id}
                className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-3 flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{contact.contact_email}</p>
                  {fingerprints[contact.id] && (
                    <p className="text-xs text-gray-600 font-mono mt-0.5 truncate">
                      {fingerprints[contact.id]}
                    </p>
                  )}
                </div>
                <button
                  onClick={() => handleRemoveContact(contact.id)}
                  className="text-gray-600 hover:text-red-400 transition-colors flex-shrink-0"
                  title="Remove contact"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3 6 5 6 21 6" />
                    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
                    <path d="M10 11v6M14 11v6" />
                    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
                  </svg>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function FingerprintDisplay({ publicKey }: { publicKey: string }) {
  const [fp, setFp] = useState<string>('loading…')
  useEffect(() => {
    getPublicKeyFingerprint(publicKey).then(setFp).catch(() => setFp('error'))
  }, [publicKey])
  return <>{fp}</>
}
