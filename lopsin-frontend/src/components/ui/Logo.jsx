export default function Logo({ size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" role="img" aria-label="Lopsin">
      <rect width="32" height="32" fill="#1868db" />
      <path d="M16 5 L26 9 v8 c0 5.5-4.2 9.4-10 11-5.8-1.6-10-5.5-10-11V9 Z" fill="#ffffff" />
      <path d="M16 13 L11 20 M16 13 L21 20 M11 20 L21 20" stroke="#1868db" strokeWidth="1.3" fill="none" />
      <circle cx="16" cy="13" r="2.4" fill="#1868db" />
      <circle cx="11" cy="20" r="2" fill="#1868db" />
      <circle cx="21" cy="20" r="2" fill="#1868db" />
    </svg>
  )
}
