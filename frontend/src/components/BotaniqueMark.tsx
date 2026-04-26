/**
 * BotaniqueMark — SVG logo mark for Ask Botanique
 * A single leaf in a rounded-square tile.
 * Works on both light (parchment) and dark (teal) backgrounds.
 *
 * variant="light"  → dark teal tile with white leaf  (for dark nav bars)
 * variant="paper"  → same dark teal tile             (for paper/parchment nav)
 */
export function BotaniqueMark({
  size = 32,
  variant = 'light',
}: {
  size?: number
  variant?: 'light' | 'paper'
}) {
  const r = Math.round(size * 0.25)           // corner radius ≈ 25% of size

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      style={{ display: 'block', flexShrink: 0 }}
      aria-label="Ask Botanique"
    >
      {/* tile */}
      <rect
        width="32"
        height="32"
        rx={r}
        fill={variant === 'paper' ? '#1a5d5d' : '#1a5d5d'}
      />

      {/* stylised leaf — drawn in a 32×32 space */}
      {/* stem */}
      <line x1="16" y1="22" x2="16" y2="27"
        stroke="rgba(255,255,255,0.7)" strokeWidth="1.6" strokeLinecap="round" />
      {/* main leaf blade */}
      <path
        d="M16 22 C16 22 9 17 10 10 C10 10 14 8 16 6 C18 8 22 10 22 10 C23 17 16 22 16 22Z"
        fill="white"
        opacity="0.95"
      />
      {/* midrib */}
      <line x1="16" y1="22" x2="16" y2="9"
        stroke="#1a5d5d" strokeWidth="0.9" strokeLinecap="round" opacity="0.5" />
    </svg>
  )
}
