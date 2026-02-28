export function Logo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="4" y="14" width="24" height="16" rx="3" fill="#ffffff" fillOpacity="0.12" stroke="#ffffff" strokeWidth="1.5" />
      <path d="M10 14V10C10 6.686 12.686 4 16 4C19.314 4 22 6.686 22 10V14" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx="16" cy="22" r="2.5" fill="#ffffff" />
      <line x1="16" y1="24.5" x2="16" y2="27" stroke="#ffffff" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  )
}
