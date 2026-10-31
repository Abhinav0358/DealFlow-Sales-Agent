import { useState } from 'react'

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
      {tier === 'Hot' && <circle cx="5" cy="5" r="4.5" fill="#ff6a2c" />}
      {tier === 'Warm' && <><circle cx="5" cy="5" r="4" fill="none" stroke="#8b8f98" /><path d="M5 1a4 4 0 0 1 0 8z" fill="#8b8f98" /></>}
      {tier === 'Cold' && <circle cx="5" cy="5" r="4" fill="none" stroke="#5b5f68" />}
    </svg>
  )
}

// Smoothly expandable section (grid-rows trick animates to/from auto height).
export function Disclosure({ title, summary, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="border-t border-line">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="group flex w-full items-center justify-between gap-6 py-4 text-left">
        <span className="flex min-w-0 items-baseline gap-4">
          <Label>{title}</Label>
          <span className="truncate text-[13px] text-mute transition-colors group-hover:text-fg">{summary}</span>
        </span>
        <span className={`font-mono text-base leading-none text-dim transition-all duration-300 group-hover:text-signal ${open ? 'rotate-45' : ''}`}>+</span>
      </button>
      <div className={`grid transition-[grid-template-rows,opacity] duration-300 ease-out ${open ? 'grid-rows-[1fr] opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <div className="overflow-hidden"><div className="pb-6 pt-1">{children}</div></div>
      </div>
    </div>
  )
}
