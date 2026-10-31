export const fmtTime = (ts) => (ts ? new Date(ts).toLocaleString() : '—')
export const pad = (n) => String(n).padStart(2, '0')

export function Label({ children, className = 'text-dim' }) {
  return <div className={`label ${className}`}>{children}</div>
}

export function Tag({ children, className = '' }) {
  return <span className={`inline-flex items-center rounded-md border border-white/10 px-2 py-0.5 font-mono text-[11px] text-mute ${className}`}>{children}</span>
}

const DOT = { done: 'bg-fg/60', running: 'bg-signal animate-pulse', queued: 'bg-dim', error: 'bg-alert' }
export function StatusDot({ status }) {
  return <span className={`inline-block h-1.5 w-1.5 shrink-0 rounded-full ${DOT[status] || 'bg-dim'}`} />
}

// Tier as a glyph: filled = Hot, half = Warm, hollow = Cold. Lime is reserved for what needs attention.
export function TierDot({ tier, size = 10 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 10 10" aria-label={tier} className="shrink-0">
      {tier === 'Hot' && <circle cx="5" cy="5" r="4.5" fill="#c9f24a" />}
      {tier === 'Warm' && <><circle cx="5" cy="5" r="4" fill="none" stroke="#8b8f98" /><path d="M5 1a4 4 0 0 1 0 8z" fill="#8b8f98" /></>}
      {tier === 'Cold' && <circle cx="5" cy="5" r="4" fill="none" stroke="#5b5f68" />}
    </svg>
  )
}
