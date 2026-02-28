import { type InputHTMLAttributes } from 'react'

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
}

export function Input({ label, error, className = '', ...props }: InputProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label && (
        <label className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          {label}
        </label>
      )}
      <input
        className={`
          w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2.5
          text-sm text-white placeholder-gray-600
          focus:outline-none focus:border-white/30 focus:bg-white/[0.07]
          transition-all duration-150
          disabled:opacity-40 disabled:cursor-not-allowed
          ${error ? 'border-red-500/50 focus:border-red-500/70' : ''}
          ${className}
        `}
        {...props}
      />
      {error && <p className="text-xs text-red-400">{error}</p>}
    </div>
  )
}
