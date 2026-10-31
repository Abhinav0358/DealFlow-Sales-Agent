import { useEffect, useMemo, useState } from 'react'
import { api } from './api'

const TIER = {
  Hot: 'border-rose-400/25 bg-rose-400/10 text-rose-200',
  Warm: 'border-amber-400/25 bg-amber-400/10 text-amber-200',
  Cold: 'border-sky-400/20 bg-sky-400/10 text-sky-200',
}
const APPROVAL = {
  approved: 'border-emerald-400/25 bg-emerald-400/10 text-emerald-200',
  rejected: 'border-white/10 bg-white/[0.03] text-slate-500 line-through',
  pending: 'border-white/10 bg-white/[0.03] text-slate-400',
}

const fmtTime = (ts) => (ts ? new Date(ts).toLocaleString() : '—')

function StepIcon({ status }) {
  if (status === 'done') return <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-500/15 text-[11px] text-emerald-300">✓</span>
  if (status === 'running') return <span className="h-5 w-5 animate-spin rounded-full border-2 border-indigo-400/30 border-t-indigo-300" />
  if (status === 'error') return <span className="grid h-5 w-5 place-items-center rounded-full bg-rose-500/15 text-[11px] text-rose-300">!</span>
  if (status === 'skipped') return <span className="grid h-5 w-5 place-items-center rounded-full bg-white/5 text-[11px] text-slate-500">–</span>
  return <span className="h-5 w-5 rounded-full border border-white/10" />
}

function Stat({ label, value, sub }) {
  return (
    <div className="card px-5 py-4">
      <div className="label">{label}</div>
      <div className="mt-1.5 text-2xl font-semibold tabular-nums tracking-tight text-white">{value}</div>
      {sub && <div className="mt-0.5 text-xs text-slate-500">{sub}</div>}
    </div>
  )
}

function ScoreRing({ score }) {
  const color = score >= 80 ? '#fb7185' : score >= 60 ? '#fbbf24' : '#38bdf8'
  return (
    <div className="relative grid h-10 w-10 place-items-center">
      <svg viewBox="0 0 36 36" className="absolute inset-0 -rotate-90">
        <circle cx="18" cy="18" r="15.5" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="3" />
        <circle cx="18" cy="18" r="15.5" fill="none" stroke={color} strokeWidth="3" strokeLinecap="round"
          strokeDasharray={`${(score / 100) * 97.4} 97.4`} />
      </svg>
      <span className="text-[12px] font-semibold tabular-nums text-white">{Math.round(score)}</span>
    </div>
  )
}

function Drawer({ p, onClose, onSave }) {
  const [subject, setSubject] = useState(p.draft_subject)
  const [body, setBody] = useState(p.draft_body)
  const [saving, setSaving] = useState(false)
  const dirty = subject !== p.draft_subject || body !== p.draft_body
  const per = p.person, co = p.company || {}

  const act = async (approval) => {
    setSaving(true)
    await onSave(p.id, { approval, ...(dirty ? { draft_subject: subject, draft_body: body } : {}) })
    setSaving(false)
  }

  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/50 backdrop-blur-[2px]" onClick={onClose}>
      <div className="h-full w-full max-w-2xl overflow-y-auto border-l border-white/[0.06] bg-ink-900 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 z-10 flex items-start justify-between border-b border-white/[0.06] bg-ink-900/95 px-6 py-5 backdrop-blur">
          <div className="flex items-center gap-4">
            <ScoreRing score={p.score} />
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white">{per.name}</h2>
                <span className={`rounded-md border px-1.5 py-0.5 text-[11px] ${TIER[per.tier]}`}>{per.tier}</span>
              </div>
              <div className="text-sm text-slate-400">{per.title || 'Title unavailable'} · {co.name}</div>
            </div>
          </div>
          <button className="btn-ghost px-2 py-1" onClick={onClose}>✕</button>
        </div>

        <div className="space-y-6 px-6 py-6">
          <p className="text-sm text-slate-300">{p.explanation.summary}</p>

          <section>
            <div className="label">Score breakdown · {Math.round(p.score)}/100</div>
            <div className="mt-3 space-y-3">
              {p.breakdown.map((b) => (
                <div key={b.criterion}>
                  <div className="flex items-baseline justify-between text-sm">
                    <span className="text-slate-200">{b.criterion}</span>
                    <span className="tabular-nums text-slate-400">{b.points}<span className="text-slate-600">/{b.max}</span></span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-400" style={{ width: `${(b.points / b.max) * 100}%` }} />
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {b.reason}{b.field && <code className="ml-1.5 rounded bg-white/[0.04] px-1 py-0.5 text-[10px] text-slate-500">{b.field}</code>}
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2">
              <div className="label">Verified facts</div>
              <span className="rounded border border-emerald-400/20 bg-emerald-400/10 px-1.5 text-[10px] text-emerald-300">From Crustdata</span>
            </div>
            <div className="mt-3 overflow-hidden rounded-lg border border-white/[0.06]">
              {p.explanation.facts.map((f, i) => (
                <div key={i} className="grid grid-cols-[140px_1fr] gap-3 border-b border-white/[0.04] px-3 py-2 text-sm last:border-0">
                  <div className="text-slate-500">{f.label}</div>
                  <div className="min-w-0">
                    <div className="text-slate-200">{String(f.value)}</div>
                    <div className="mt-0.5 truncate text-[10px] text-slate-600">
                      <code>{f.field}</code>
                      {f.source && <> · <a className="text-indigo-300/70 hover:text-indigo-200" href={f.source} target="_blank" rel="noreferrer">source ↗</a></>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-2 text-[11px] text-slate-600">
              Person: {p.source}, fetched {fmtTime(p.fetched_at)} · Company: {p.company_source}, fetched {fmtTime(p.company_fetched_at)}
            </div>
          </section>

          <section>
            <div className="flex items-center gap-2">
              <div className="label">Inferences</div>
              <span className="rounded border border-amber-400/20 bg-amber-400/10 px-1.5 text-[10px] text-amber-300">Not verified · derived from facts</span>
            </div>
            {p.explanation.inferences.length === 0
              ? <p className="mt-3 text-sm text-slate-500">Not enough data to draw inferences. Only verified facts are shown.</p>
              : <ul className="mt-3 space-y-2">
                  {p.explanation.inferences.map((x, i) => (
                    <li key={i} className="rounded-lg border border-amber-400/10 bg-amber-400/[0.03] px-3 py-2 text-sm text-slate-300">
                      {x.text} <span className="text-xs text-slate-500">(based on: {x.based_on})</span>
                    </li>
                  ))}
                </ul>}
          </section>

          <section>
            <div className="flex items-center justify-between">
              <div className="label">Outreach draft</div>
              <div className="text-[11px] text-slate-500">
                Personalized with: {p.explanation.draft_hooks?.length ? p.explanation.draft_hooks.join(', ') : 'generic opener (no strong signal)'}
              </div>
            </div>
            <input className="input mt-3 font-medium" value={subject} onChange={(e) => setSubject(e.target.value)} />
            <textarea className="input mt-2 min-h-56 font-mono text-[13px] leading-relaxed" value={body} onChange={(e) => setBody(e.target.value)} />
            <div className="mt-2 flex flex-wrap gap-3 text-xs">
              {per.profile_url && <a className="text-indigo-300 hover:text-indigo-200" href={per.profile_url} target="_blank" rel="noreferrer">LinkedIn profile ↗</a>}
              {co.website && <a className="text-indigo-300 hover:text-indigo-200" href={co.website} target="_blank" rel="noreferrer">{co.domain || 'Company site'} ↗</a>}
            </div>
          </section>
        </div>

        <div className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-white/[0.06] bg-ink-900/95 px-6 py-4 backdrop-blur">
          <span className={`rounded-md border px-2 py-0.5 text-xs capitalize ${APPROVAL[p.approval]}`}>{p.approval}</span>
          <div className="flex gap-2">
            {dirty && <button className="btn-ghost" disabled={saving} onClick={() => act(p.approval)}>Save edits</button>}
            <button className="btn-ghost" disabled={saving} onClick={() => act('rejected')}>Reject</button>
            <button className="btn btn-primary bg-emerald-600 hover:bg-emerald-500" disabled={saving} onClick={() => act('approved')}>Approve draft</button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Campaign({ id, onChange }) {
  const [c, setC] = useState(null)
  const [err, setErr] = useState('')
  const [filter, setFilter] = useState('All')
  const [openId, setOpenId] = useState(null)

  const load = () => api.get(id).then((d) => { setC(d); setErr('') }).catch((e) => setErr(e.message))
  useEffect(() => { load() }, [id])
  useEffect(() => {
    if (!c || c.status === 'done' || c.status === 'error') return
    const t = setTimeout(load, 1200)
    return () => clearTimeout(t)
  }, [c])

  const rows = useMemo(() => {
    if (!c) return []
    if (filter === 'All') return c.prospects
    if (filter === 'Approved') return c.prospects.filter((p) => p.approval === 'approved')
    return c.prospects.filter((p) => p.person.tier === filter)
  }, [c, filter])

  const save = async (pid, body) => { await api.update(pid, body); await load(); onChange?.() }
  const bulk = async (tier) => {
    await Promise.all(c.prospects.filter((p) => p.person.tier === tier && p.approval === 'pending').map((p) => api.update(p.id, { approval: 'approved' })))
    await load(); onChange?.()
  }

  if (err) return <div className="p-10 text-rose-300">{err}</div>
  if (!c) return <div className="p-10 text-slate-500">Loading…</div>

  const ps = c.prospects
  const count = (t) => ps.filter((p) => p.person.tier === t).length
  const approved = ps.filter((p) => p.approval === 'approved').length
  const avg = ps.length ? Math.round(ps.reduce((s, p) => s + p.score, 0) / ps.length) : 0
  const running = c.status === 'running' || c.status === 'queued'
  const open = ps.find((p) => p.id === openId)

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 lg:px-10">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="label text-indigo-300/80">Campaign #{c.id} · {fmtTime(c.created_at)}</div>
          <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">{c.prompt}</h1>
          {c.icp && (
            <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
              {c.icp.titles.map((t) => <span key={t} className="rounded-md border border-indigo-400/20 bg-indigo-400/10 px-2 py-0.5 text-indigo-200">{t}</span>)}
              {c.icp.country && <span className="rounded-md border border-white/10 px-2 py-0.5 text-slate-300">{c.icp.country.label}</span>}
              {(c.icp.headcount_min != null || c.icp.headcount_max != null) &&
                <span className="rounded-md border border-white/10 px-2 py-0.5 text-slate-300">{c.icp.headcount_min ?? 0}–{c.icp.headcount_max ?? '∞'} employees</span>}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <a className={`btn-ghost ${!ps.length ? 'pointer-events-none opacity-40' : ''}`} href={api.exportUrl(c.id, true)}>Export all</a>
          <a className={`btn-primary ${!approved ? 'pointer-events-none opacity-40' : ''}`} href={api.exportUrl(c.id)}>Export approved ({approved}) ↓</a>
        </div>
      </div>

      <div className="card mt-6 p-5">
        <div className="flex items-center justify-between">
          <div className="label">Agent execution</div>
          <div className="text-xs text-slate-500">{running ? 'Running…' : c.status === 'error' ? 'Stopped with error' : 'Complete'}</div>
        </div>
        <ol className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
          {c.steps.map((s) => (
            <li key={s.name} className={`rounded-lg border px-3 py-2.5 ${s.status === 'running' ? 'border-indigo-400/30 bg-indigo-400/[0.05]' : s.status === 'error' ? 'border-rose-400/30 bg-rose-400/[0.05]' : 'border-white/[0.05]'}`}>
              <div className="flex items-center gap-2"><StepIcon status={s.status} /><span className="text-[13px] font-medium text-slate-200">{s.name}</span></div>
              {s.detail && <div className="mt-1.5 text-[11px] leading-snug text-slate-500">{s.detail}</div>}
            </li>
          ))}
        </ol>
        {c.error && <div className="mt-4 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
          {c.error}{ps.length > 0 && ' Partial results are shown below.'}</div>}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <Stat label="Companies" value={c.companies_count} sub="via Crustdata" />
        <Stat label="Prospects" value={ps.length} sub="decision-makers" />
        <Stat label="Hot" value={count('Hot')} sub="score ≥ 80" />
        <Stat label="Avg score" value={ps.length ? avg : '—'} sub="out of 100" />
        <Stat label="Approved" value={approved} sub={`of ${ps.length} drafts`} />
      </div>

      <div className="card mt-6 overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/[0.06] px-5 py-3">
          <div className="flex gap-1">
            {['All', 'Hot', 'Warm', 'Cold', 'Approved'].map((f) => (
              <button key={f} onClick={() => setFilter(f)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${filter === f ? 'bg-white/[0.08] text-white' : 'text-slate-400 hover:text-slate-200'}`}>{f}</button>
            ))}
          </div>
          {count('Hot') > 0 && <button className="btn-ghost py-1.5 text-xs" onClick={() => bulk('Hot')}>Approve all Hot</button>}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[860px] text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500">
                <th className="px-5 py-3 font-medium">Score</th>
                <th className="px-3 py-3 font-medium">Prospect</th>
                <th className="px-3 py-3 font-medium">Company</th>
                <th className="px-3 py-3 font-medium">Size</th>
                <th className="px-3 py-3 font-medium">Top signal</th>
                <th className="px-5 py-3 text-right font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const top = [...p.breakdown].sort((a, b) => b.points / b.max - a.points / a.max)[0]
                return (
                  <tr key={p.id} onClick={() => setOpenId(p.id)} className="cursor-pointer border-t border-white/[0.04] transition hover:bg-white/[0.025]">
                    <td className="px-5 py-3"><div className="flex items-center gap-2"><ScoreRing score={p.score} /><span className={`rounded-md border px-1.5 py-0.5 text-[11px] ${TIER[p.person.tier]}`}>{p.person.tier}</span></div></td>
                    <td className="px-3 py-3">
                      <div className="font-medium text-slate-100">{p.person.name}</div>
                      <div className="text-xs text-slate-500">{p.person.title || '—'}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-slate-200">{p.company?.name}</div>
                      <div className="text-xs text-slate-500">{p.company?.industry || p.company?.domain || '—'}</div>
                    </td>
                    <td className="px-3 py-3 tabular-nums text-slate-300">{p.company?.headcount != null ? p.company.headcount.toLocaleString() : '—'}</td>
                    <td className="max-w-xs px-3 py-3 text-xs text-slate-400"><span className="line-clamp-2">{top?.reason}</span></td>
                    <td className="px-5 py-3 text-right"><span className={`rounded-md border px-2 py-0.5 text-xs capitalize ${APPROVAL[p.approval]}`}>{p.approval}</span></td>
                  </tr>
                )
              })}
              {rows.length === 0 && (
                <tr><td colSpan="6" className="px-5 py-14 text-center text-sm text-slate-500">
                  {running ? 'The agent is working. Prospects will appear here when scoring finishes.'
                    : ps.length ? 'No prospects in this view.' : 'No prospects found for this request. Try broader criteria.'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {open && <Drawer key={open.id + open.approval} p={open} onClose={() => setOpenId(null)} onSave={save} />}
    </div>
  )
}
