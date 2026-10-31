import { useEffect, useState } from 'react'
import { api } from './api'
import { Label, Tag } from './ui'

const EXAMPLES = [
  'CTOs and VP Engineering at Series B fintech startups in the US with 50-500 employees',
  'Heads of sales at mid-market cybersecurity companies in the US',
  'Founders of AI developer tools startups in the US with under 200 employees',
]

function Row({ label, children }) {
  return (
    <div className="border-t border-line py-4 first:border-t-0 first:pt-0">
      <Label>{label}</Label>
      <div className="mt-2 text-[15px] text-fg">{children}</div>
    </div>
  )
}

export default function NewCampaign({ onCreated, health }) {
  const [prompt, setPrompt] = useState('')
  const [offering, setOffering] = useState('')
  const [sender, setSender] = useState('')
  const [maxCompanies, setMaxCompanies] = useState(10)
  const [icp, setIcp] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!prompt.trim()) { setIcp(null); return }
    const t = setTimeout(() => api.parse({ prompt, offering }).then(setIcp).catch(() => {}), 300)
    return () => clearTimeout(t)
  }, [prompt, offering])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      const { id } = await api.create({ prompt, offering, sender, max_companies: maxCompanies })
      onCreated(id)
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  const hc = icp && (icp.headcount_min != null || icp.headcount_max != null)
    ? `${icp.headcount_min ?? 0}–${icp.headcount_max ?? '∞'} employees` : null

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-10 md:px-10 md:py-16">
      <Label>New campaign</Label>
      <h1 className="mt-5 max-w-4xl text-[2.5rem] font-medium leading-[1.04] tracking-[-0.035em] text-fg md:text-6xl">
        Who do you want to reach?
        <span className="block text-dim">We find them, score them, and draft the note.</span>
      </h1>

      <form onSubmit={submit} className="mt-14 grid gap-14 lg:grid-cols-[minmax(0,1fr)_400px] lg:gap-20">
        <div className="space-y-10">
          <div>
            <Label>Prospecting request</Label>
            <textarea className="field mt-2 min-h-28 resize-none text-2xl leading-snug tracking-[-0.01em]" rows={3} value={prompt}
              onChange={(e) => setPrompt(e.target.value)} placeholder="CTOs at Series B fintech startups in the US…" />
            <ul className="mt-4 space-y-1.5">
              {EXAMPLES.map((x) => (
                <li key={x}>
                  <button type="button" onClick={() => setPrompt(x)}
                    className="group flex w-full items-baseline gap-3 text-left font-mono text-xs text-dim transition-colors hover:text-fg">
                    <span className="text-dim transition-transform group-hover:translate-x-0.5 group-hover:text-signal">→</span>{x}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid gap-8 sm:grid-cols-2">
            <div>
              <Label>What you're offering</Label>
              <input className="field mt-1" value={offering} onChange={(e) => setOffering(e.target.value)} placeholder="an AI code-review platform" />
            </div>
            <div>
              <Label>Sender name</Label>
              <input className="field mt-1" value={sender} onChange={(e) => setSender(e.target.value)} placeholder="Alex from Acme" />
            </div>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <Label>Companies to research</Label>
              <span className="font-mono text-sm tabular-nums text-fg">{maxCompanies}</span>
            </div>
            <input type="range" min="3" max="25" value={maxCompanies} onChange={(e) => setMaxCompanies(+e.target.value)}
              className="mt-3 w-full accent-[#c9f24a]" />
            <p className="mt-2 text-[13px] text-dim">Up to 3 decision-makers per company. Repeated queries are served from cache and use no extra credits.</p>
          </div>

          {err && <p className="border-l-2 border-alert pl-3 text-sm text-alert">{err}</p>}
          {health && !health.crustdata_key && (
            <p className="border-l-2 border-alert pl-3 text-sm text-alert">
              Crustdata API key missing. Add <code className="font-mono">CRUSTDATA_API_KEY</code> to <code className="font-mono">backend/.env</code>.
            </p>
          )}

          <button className="pill-solid px-7 py-3 text-[15px]" disabled={!prompt.trim() || busy}>
            {busy ? 'Launching agent…' : 'Run prospecting agent →'}
          </button>
        </div>

        <aside className="self-start rounded-3xl border border-line bg-panel p-7 lg:sticky lg:top-10">
          <div className="flex items-center justify-between">
            <Label>Interpreted ICP</Label>
            <Label className={icp ? 'text-signal' : 'text-dim'}>{icp ? '● Live' : 'Waiting'}</Label>
          </div>
          {!icp ? (
            <p className="mt-6 text-sm leading-relaxed text-dim">Start typing and DealFlow shows exactly how it reads your request before any credits are spent.</p>
          ) : (
            <div className="mt-6">
              <Row label="Company query"><span className="text-xl tracking-tight">“{icp.company_query}”</span></Row>
              <Row label="Target roles"><div className="flex flex-wrap gap-1.5">{icp.titles.map((t) => <Tag key={t}>{t}</Tag>)}</div></Row>
              <div className="grid grid-cols-2 gap-6 border-t border-line pt-4">
                <div><Label>Geography</Label><div className="mt-2 text-[15px]">{icp.country?.label || <span className="text-mute">Any</span>}</div></div>
                <div><Label>Company size</Label><div className="mt-2 font-mono text-[14px]">{hc || <span className="font-sans text-[15px] text-mute">Any</span>}</div></div>
              </div>
              {icp.funding_signal && <div className="mt-4 border-t border-line pt-4"><Label>Funding signal</Label><div className="mt-2 text-[15px] capitalize">{icp.funding_signal}</div></div>}
              {icp.notes.length > 0 && (
                <div className="mt-4 space-y-1 border-t border-line pt-4 text-[13px] text-mute">
                  {icp.notes.map((n) => <p key={n}>{n}</p>)}
                </div>
              )}
            </div>
          )}
        </aside>
      </form>
    </div>
  )
}
