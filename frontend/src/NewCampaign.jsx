import { useEffect, useState } from 'react'
import { api } from './api'

const EXAMPLES = [
  'CTOs and VP Engineering at Series B fintech startups in the US with 50-500 employees',
  'Heads of sales at mid-market cybersecurity companies in the US',
  'Founders of AI developer tools startups in the US with under 200 employees',
]

function Chip({ children, tone = 'slate' }) {
  const tones = {
    slate: 'border-white/10 bg-white/[0.03] text-slate-300',
    indigo: 'border-indigo-400/20 bg-indigo-400/10 text-indigo-200',
  }
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs ${tones[tone]}`}>{children}</span>
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
    <div className="mx-auto max-w-5xl px-6 py-10 lg:px-10">
      <div className="label text-indigo-300/80">New campaign</div>
      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-white">Who do you want to reach?</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">
        Describe your ideal customer in plain English. DealFlow discovers matching companies and decision-makers
        through Crustdata, scores every prospect with a transparent breakdown, and prepares outreach drafts for your approval.
      </p>

      <form onSubmit={submit} className="mt-8 grid gap-6 lg:grid-cols-5">
        <div className="card space-y-5 p-6 lg:col-span-3">
          <div>
            <label className="label">Prospecting request</label>
            <textarea className="input mt-2 min-h-28 resize-y text-[15px] leading-relaxed" value={prompt}
              onChange={(e) => setPrompt(e.target.value)} placeholder="e.g. CTOs at Series B fintech startups in the US with 50-500 employees" />
            <div className="mt-2 flex flex-wrap gap-2">
              {EXAMPLES.map((x) => (
                <button type="button" key={x} onClick={() => setPrompt(x)}
                  className="rounded-md border border-white/[0.06] bg-white/[0.02] px-2 py-1 text-left text-[11px] text-slate-400 hover:border-indigo-400/30 hover:text-slate-200">{x}</button>
              ))}
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">What you're offering</label>
              <input className="input mt-2" value={offering} onChange={(e) => setOffering(e.target.value)} placeholder="e.g. an AI code-review platform" />
            </div>
            <div>
              <label className="label">Sender name</label>
              <input className="input mt-2" value={sender} onChange={(e) => setSender(e.target.value)} placeholder="e.g. Alex from Acme" />
            </div>
          </div>
          <div>
            <div className="flex items-center justify-between">
              <label className="label">Companies to research</label>
              <span className="text-xs tabular-nums text-slate-400">{maxCompanies}</span>
            </div>
            <input type="range" min="3" max="25" value={maxCompanies} onChange={(e) => setMaxCompanies(+e.target.value)}
              className="mt-2 w-full accent-indigo-500" />
            <p className="mt-1 text-[11px] text-slate-500">Up to 3 decision-makers per company. Repeated queries are served from cache and use no extra credits.</p>
          </div>
          {err && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">{err}</div>}
          {health && !health.crustdata_key && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
              Crustdata API key missing. Add <code>CRUSTDATA_API_KEY</code> to <code>backend/.env</code> and restart the backend.
            </div>
          )}
          <button className="btn-primary w-full py-2.5" disabled={!prompt.trim() || busy}>
            {busy ? 'Launching agent…' : 'Run prospecting agent →'}
          </button>
        </div>

        <div className="card p-6 lg:col-span-2">
          <div className="label">Interpreted ICP</div>
          {!icp ? (
            <p className="mt-4 text-sm text-slate-500">Start typing to see how DealFlow interprets your request.</p>
          ) : (
            <dl className="mt-4 space-y-4 text-sm">
              <div>
                <dt className="text-xs text-slate-500">Company search query</dt>
                <dd className="mt-1 font-medium text-slate-100">"{icp.company_query}"</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Target roles</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">{icp.titles.map((t) => <Chip key={t} tone="indigo">{t}</Chip>)}</dd>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <dt className="text-xs text-slate-500">Geography</dt>
                  <dd className="mt-1 text-slate-200">{icp.country?.label || 'Any (ranked by query)'}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Company size</dt>
                  <dd className="mt-1 text-slate-200">{hc || 'Any'}</dd>
                </div>
              </div>
              {icp.funding_signal && (
                <div>
                  <dt className="text-xs text-slate-500">Funding signal</dt>
                  <dd className="mt-1 capitalize text-slate-200">{icp.funding_signal}</dd>
                </div>
              )}
              {icp.notes.length > 0 && (
                <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] p-3 text-xs text-slate-400">
                  {icp.notes.map((n) => <div key={n}>• {n}</div>)}
                </div>
              )}
            </dl>
          )}
        </div>
      </form>
    </div>
  )
}
