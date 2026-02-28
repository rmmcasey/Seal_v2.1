import { useRef, useState, type DragEvent, type ChangeEvent } from 'react'

interface DropZoneProps {
  accept?: string
  onFile: (file: File) => void
  label: string
  sublabel?: string
  file?: File | null
  disabled?: boolean
}

export function DropZone({ accept, onFile, label, sublabel, file, disabled }: DropZoneProps) {
  const [isDragging, setIsDragging] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    setIsDragging(false)
    if (disabled) return
    const dropped = e.dataTransfer.files[0]
    if (dropped) onFile(dropped)
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0]
    if (selected) onFile(selected)
    e.target.value = ''
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  return (
    <div
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={(e) => { e.preventDefault(); if (!disabled) setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={handleDrop}
      className={`
        relative border-2 border-dashed rounded-xl p-10 text-center cursor-pointer
        transition-all duration-200 select-none
        ${disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-white/40 hover:bg-white/[0.02]'}
        ${isDragging ? 'border-white/60 bg-white/[0.04] scale-[1.01]' : 'border-white/20'}
        ${file ? 'border-white/30 bg-white/[0.02]' : ''}
      `}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        className="hidden"
        onChange={handleChange}
        disabled={disabled}
      />

      {file ? (
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center">
            <FileIcon />
          </div>
          <div>
            <p className="text-sm font-medium text-white truncate max-w-xs">{file.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{formatSize(file.size)}</p>
          </div>
          <p className="text-xs text-gray-600 mt-1">Click or drop to replace</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-lg bg-white/5 flex items-center justify-center">
            <UploadIcon />
          </div>
          <div>
            <p className="text-sm font-medium text-white">{label}</p>
            {sublabel && <p className="text-xs text-gray-500 mt-1">{sublabel}</p>}
          </div>
          <p className="text-xs text-gray-600">or click to browse</p>
        </div>
      )}
    </div>
  )
}

function UploadIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  )
}

function FileIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  )
}
