import { useSession } from '../hooks/useSession'

export function SessionBadge() {
  const { isUnlocked, getSessionUser } = useSession()
  const email = getSessionUser()

  return (
    <div className="flex items-center gap-2">
      <div
        className={`w-2 h-2 rounded-full ${isUnlocked ? 'bg-green-400' : 'bg-red-500'}`}
        style={{ boxShadow: isUnlocked ? '0 0 6px #4ade80' : '0 0 6px #ef4444' }}
      />
      <span className="text-xs text-gray-400">
        {isUnlocked ? `Key unlocked${email ? ` · ${email}` : ''}` : 'Key locked'}
      </span>
    </div>
  )
}
