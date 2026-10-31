import { useEffect, useState } from 'react'
import { api } from './api'
import { Label, Tag } from './ui'

const EXAMPLES = [
  'CTOs and VP Engineering at Series B fintech startups in the US with 50-500 employees',
  'Heads of sales at mid-market cybersecurity companies in the US',
  'Founders of AI developer tools startups in the US with under 200 employees',
]

// Placeholders describe what to write; they are deliberately not example companies or products.
const CONTEXT_FIELDS = [
  { key: 'sender_name', label: 'Your name', required: true, kind: 'input', placeholder: 'Who the email is from' },
  { key: 'sender_company', label: 'Your company', required: true, kind: 'input', placeholder: 'Your company name' },
  { key: 'company_description', label: 'What your company does', required: false, kind: 'area', wide: true,
    placeholder: 'One or two factual sentences about your business. Used as written.' },
  { key: 'offering', label: 'What you are offering', required: true, kind: 'area', wide: true,
    placeholder: 'One full sentence, e.g. "We help … do …". Used as written.' },
  { key: 'relevance', label: 'Why it matters to these prospects', required: false, kind: 'area', wide: true,
    placeholder: 'Only claims you can stand behind. Used as written.' },
  { key: 'cta', label: 'Call to action', required: true, kind: 'input', wide: true, placeholder: 'What should they do next?' },
]
const REMEMBERED = ['sender_name', 'sender_company', 'company_description']
const EMPTY = Object.fromEntries(CONTEXT_FIELDS.map((f) => [f.key, '']))

function loadContext() {
  try {
    return { ...EMPTY, ...JSON.parse(localStorage.getItem('df.sender') || '{}') }
  } catch { return { ...EMPTY } }
}

function Row({ label, children }) {
  return (
    <div className="border-t border-line py-4 first:border-t-0 first:pt-0">
      <Label>{label}</Label>
      <div className="mt-2 text-[15px] text-fg">{children}</div>
    </div>
  )
}

function Step({ n, title, children }) {
  return (
    <section className="border-t border-line pt-8">
      <div className="flex items-baseline gap-3"><Label className="text-signal">{n}</Label><Label className="text-mute">{title}</Label></div>
      {children}
    </section>
  )
}

export default function NewCampaign({ onCreated, health }) {
  const [prompt, setPrompt] = useState('')
  const [ctx, setCtx] = useState(loadContext)
  const [maxCompanies, setMaxCompanies] = useState(10)
  const [icp, setIcp] = useState(null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const set = (k) => (e) => setCtx((c) => ({ ...c, [k]: e.target.value }))
  const missing = [
    ...(prompt.trim() ? [] : ['prospecting request']),
    ...CONTEXT_FIELDS.filter((f) => f.required && !ctx[f.key].trim()).map((f) => f.label.toLowerCase()),
  ]

  useEffect(() => {
    if (!prompt.trim()) { setIcp(null); return }
    const t = setTimeout(() => api.parse({ prompt }).then(setIcp).catch(() => {}), 300)
    return () => clearTimeout(t)
  }, [prompt])

  const submit = async (e) => {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      localStorage.setItem('df.sender', JSON.stringify(Object.fromEntries(REMEMBERED.map((k) => [k, ctx[k]]))))
      const { id } = await api.create({ prompt, context: ctx, max_companies: maxCompanies })
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
            <Label>01 · Prospecting request</Label>
            <textarea className="field mt-2 min-h-28 resize-none text-2xl leading-snug tracking-[-0.01em]" rows={3} value={prompt}
              onChange={(e) => setPrompt(e.target.value)} placeholder="CTOs at Series B fintech startups in the US…" />
            <ul className="mt-4 space-y-1.5">
              {EXAMPLES.map((x) => (
                <li key={x}>
                  <button type="button" onClick={() => setPrompt(x)}
                    className="group flex w-full items-baseline gap-3 text-left font-mono text-xs text-dim transition-colors hover:text-fg">
                    <span className="transition-transform group-hover:translate-x-0.5 group-hover:text-signal">→</span>{x}
                  </button>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="flex items-baseline justify-between">
              <Label>Companies to research</Label>
              <span className="font-mono text-sm tabular-nums text-fg">{maxCompanies}</span>
            </div>
            <input type="range" min="3" max="25" value={maxCompanies} onChange={(e) => setMaxCompanies(+e.target.value)}
              className="mt-3 w-full accent-[#ff6a2c]" />
            <p className="mt-2 text-[13px] text-dim">Up to 3 decision-makers per company. Repeated queries are served from cache and use no extra credits.</p>
          </div>

          <Step n="02" title="Outreach context">
            <p className="mt-3 max-w-xl text-[13px] leading-relaxed text-dim">
              Each draft combines your words below with verified Crustdata facts about the prospect. DealFlow never writes claims about your
              business, so what you leave blank stays out of the draft.
            </p>
            <div className="mt-6 grid gap-x-8 gap-y-7 sm:grid-cols-2">
              {CONTEXT_FIELDS.map((f) => (
                <label key={f.key} className={f.wide ? 'sm:col-span-2' : ''}>
                  <span className="flex items-baseline justify-between">
                    <Label>{f.label}</Label>
                    <Label className={f.required ? 'text-signal/80' : 'text-dim'}>{f.required ? 'Required' : 'Optional'}</Label>
                  </span>
                  {f.kind === 'area'
                    ? <textarea className="field mt-1 resize-none text-[15px] leading-snug" rows={2} value={ctx[f.key]} onChange={set(f.key)} placeholder={f.placeholder} />
                    : <input className="field mt-1 text-[15px]" value={ctx[f.key]} onChange={set(f.key)} placeholder={f.placeholder} />}
                </label>
              ))}
            </div>
          </Step>

          {err && <p className="border-l-2 border-alert pl-3 text-sm text-alert">{err}</p>}
          {health && !health.crustdata_key && (
            <p className="border-l-2 border-alert pl-3 text-sm text-alert">
              Crustdata API key missing. Add <code className="font-mono">CRUSTDATA_API_KEY</code> to <code className="font-mono">backend/.env</code>.
            </p>
          )}

          <div>
            <button className="pill-solid px-7 py-3 text-[15px]" disabled={missing.length > 0 || busy}>
              {busy ? 'Launching agent…' : 'Run prospecting agent →'}
            </button>
            {missing.length > 0 && <p className="mt-3 font-mono text-[11px] text-dim">Still needed: {missing.join(' · ')}</p>}
          </div>
        </div>

        <aside className="relative self-start overflow-hidden rounded-3xl border border-line bg-panel p-7 transition-colors duration-300 hover:border-signal/25 lg:sticky lg:top-10">
          <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-[radial-gradient(closest-side,rgb(255_106_44/0.16),transparent)]" />
          <div className="relative">
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
          </div>
        </aside>
      </form>
    </div>
  )
}
