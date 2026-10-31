import { useEffect, useMemo, useState } from 'react'
import { api } from './api'
import { fmtTime, pad, Label, Tag, TierDot, Disclosure } from './ui'
import ProspectPanel from './ProspectPanel'

const DOT = {
  done: 'bg-fg', error: 'bg-alert', skipped: 'border border-dim', pending: 'border border-dim',
  running: 'bg-signal',
}

function Timeline({ steps }) {
  return (
    <ol className="lg:grid lg:grid-cols-6">
      {steps.map((s, i) => {
        const last = i === steps.length - 1
        return (
          <li key={s.name} className={`relative border-l border-line pb-6 pl-6 lg:border-l-0 lg:pb-0 lg:pl-0 lg:pr-5 lg:pt-7 ${last ? 'border-transparent' : ''}`}>
            <span className={`absolute -left-[4.5px] top-1 h-[9px] w-[9px] rounded-full lg:left-0 lg:top-0 ${DOT[s.status] || DOT.pending}`}>
              {s.status === 'running' && <span className="absolute inset-0 animate-ping rounded-full bg-signal/60" />}
            </span>
            {!last && (
              <span className="absolute left-[15px] right-0 top-[4px] hidden h-px bg-white/10 lg:block">
                <span className={`block h-px origin-left bg-fg/50 transition-transform duration-700 ${s.status === 'done' ? 'scale-x-100' : 'scale-x-0'}`} />
              </span>
            )}
            <Label className={s.status === 'pending' || s.status === 'skipped' ? 'text-dim' : s.status === 'error' ? 'text-alert' : 'text-fg'}>{s.name}</Label>
            {s.detail && <p className={`mt-2 text-[13px] leading-snug ${s.status === 'error' ? 'text-alert/90' : 'text-mute'}`}>{s.detail}</p>}
          </li>
        )
      })}
    </ol>
  )
}

const APPROVAL = {
  approved: <span className="text-fg">✓ Approved</span>,
  rejected: <span className="text-dim line-through">Rejected</span>,
  pending: <span className="text-dim">Pending</span>,
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

  const ps = c?.prospects || []
  const count = (t) => ps.filter((p) => p.person.tier === t).length
  const approved = ps.filter((p) => p.approval === 'approved').length

  const rows = useMemo(() => {
    if (filter === 'All') return ps
    if (filter === 'Approved') return ps.filter((p) => p.approval === 'approved')
    return ps.filter((p) => p.person.tier === filter)
  }, [c, filter])

  const save = async (pid, body) => { await api.update(pid, body); await load(); onChange?.() }
  const bulk = async (tier) => {
    await Promise.all(ps.filter((p) => p.person.tier === tier && p.approval === 'pending').map((p) => api.update(p.id, { approval: 'approved' })))
    await load(); onChange?.()
  }

  if (err) return <div className="p-10 text-alert">{err}</div>
  if (!c) return <div className="p-10 font-mono text-xs text-dim">Loading…</div>

  const avg = ps.length ? Math.round(ps.reduce((s, p) => s + p.score, 0) / ps.length) : null
  const running = c.status === 'running' || c.status === 'queued'
  const open = ps.find((p) => p.id === openId)
  const topSignal = (p) => [...p.breakdown].sort((a, b) => b.points / b.max - a.points / a.max)[0]?.reason
  const stats = [
    ['Companies', c.companies_count, 'via Crustdata'],
    ['Prospects', ps.length, 'decision-makers'],
    ['Hot', count('Hot'), 'score ≥ 80', count('Hot') > 0],
    ['Avg score', avg ?? '—', 'out of 100'],
    ['Approved', approved, `of ${ps.length} drafts`],
  ]
  const empty = running ? 'The agent is working. Prospects appear here when scoring finishes.'
    : ps.length ? 'No prospects in this view.' : 'No prospects found for this request. Try broader criteria.'

  return (
    <div className="mx-auto max-w-[1200px] px-5 py-10 md:px-10 md:py-14">
      <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-6">
        <div className="min-w-0 max-w-3xl">
          <Label>Campaign {pad(c.id)} · {fmtTime(c.created_at)}</Label>
          <h1 className="mt-5 text-3xl font-medium leading-[1.08] tracking-[-0.03em] md:text-5xl">{c.prompt}</h1>
          {c.icp && (
            <div className="mt-5 flex flex-wrap gap-1.5">
              {c.icp.titles.map((t) => <Tag key={t}>{t}</Tag>)}
              {c.icp.country && <Tag className="text-fg">{c.icp.country.label}</Tag>}
              {(c.icp.headcount_min != null || c.icp.headcount_max != null) && <Tag className="text-fg">{c.icp.headcount_min ?? 0}–{c.icp.headcount_max ?? '∞'} employees</Tag>}
            </div>
          )}
        </div>
        <div className="flex gap-2">
          <a className={`pill-line ${!ps.length ? 'pointer-events-none opacity-40' : ''}`} href={api.exportUrl(c.id, true)}>Export all</a>
          <a className={`pill-solid ${!approved ? 'pointer-events-none opacity-30' : ''}`} href={api.exportUrl(c.id)}>Export approved ({approved}) ↓</a>
        </div>
      </div>

      {c.context && (
        <div className="mt-10">
          <Disclosure title="Outreach context" summary={`${c.context.sender_name}, ${c.context.sender_company}`}>
            <dl className="grid gap-x-10 gap-y-5 sm:grid-cols-2">
              {[
                ['Sender', `${c.context.sender_name}, ${c.context.sender_company}`],
                ['What the company does', c.context.company_description],
                ['Offering', c.context.offering],
                ['Why it matters to prospects', c.context.relevance],
                ['Call to action', c.context.cta],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt><Label>{k}</Label></dt>
                  <dd className={`mt-1.5 text-[14px] leading-snug ${v ? 'text-fg/90' : 'text-dim'}`}>{v || 'Not provided. Left out of the drafts.'}</dd>
                </div>
              ))}
            </dl>
          </Disclosure>
        </div>
      )}

      <section className={`${c.context ? 'mt-4' : 'mt-14'} border-t border-line pt-6`}>
        <div className="mb-6 flex items-center justify-between">
          <Label>Agent execution</Label>
          <Label className={running ? 'text-signal' : c.status === 'error' ? 'text-alert' : 'text-dim'}>
            {running ? '● Running' : c.status === 'error' ? 'Stopped with error' : 'Complete'}
          </Label>
        </div>
        <Timeline steps={c.steps} />
        {c.error && <p className="mt-6 border-l-2 border-alert pl-3 text-sm text-alert">{c.error}{ps.length > 0 && ' Partial results are shown below.'}</p>}
      </section>

      <dl className="mt-14 grid grid-cols-2 border-y border-line sm:grid-cols-5 sm:divide-x sm:divide-line">
        {stats.map(([label, value, sub, hot]) => (
          <div key={label} className="py-5 sm:px-6 sm:py-6 sm:first:pl-0">
            <dt><Label>{label}</Label></dt>
            <dd className={`mt-3 font-mono text-3xl font-medium sm:text-4xl leading-none tracking-tight tabular-nums ${hot ? 'text-signal' : ''}`}>{value}</dd>
            <dd className="mt-2 font-mono text-[11px] text-dim">{sub}</dd>
          </div>
        ))}
      </dl>

      <section className="mt-14">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line">
          <div className="flex gap-6 overflow-x-auto">
            {['All', 'Hot', 'Warm', 'Cold', 'Approved'].map((f) => {
              const n = f === 'All' ? ps.length : f === 'Approved' ? approved : count(f)
              return (
                <button key={f} onClick={() => setFilter(f)}
                  className={`-mb-px flex items-baseline gap-1.5 border-b pb-3 text-sm transition-colors ${filter === f ? 'border-signal text-fg' : 'border-transparent text-dim hover:text-mute'}`}>
                  {f}<span className="font-mono text-[11px] text-dim">{n}</span>
                </button>
              )
            })}
          </div>
          {count('Hot') > 0 && <button className="mb-2 font-mono text-xs text-mute transition-colors hover:text-signal" onClick={() => bulk('Hot')}>Approve all Hot →</button>}
        </div>

        <table className="hidden w-full text-sm md:table">
          <thead>
            <tr className="text-left">
              {['Score', 'Prospect', 'Company', 'Size', 'Top signal', 'Status'].map((h, i) => (
                <th key={h} className={`py-4 font-normal ${i === 5 ? 'text-right' : ''} ${i === 0 ? 'pl-3' : ''}`}><Label>{h}</Label></th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} onClick={() => setOpenId(p.id)}
                className={`group cursor-pointer border-t border-line transition-colors duration-200 ${openId === p.id ? 'bg-signal/[0.06]' : 'hover:bg-signal/[0.065]'}`}>
                <td className={`w-32 py-4 pl-3 pr-4 transition-shadow duration-200 ${openId === p.id ? 'shadow-[inset_2px_0_0_0_#ff6a2c]' : 'group-hover:shadow-[inset_2px_0_0_0_rgb(255_106_44/0.55)]'}`}>
                  <div className="flex items-center gap-3">
                    <span className="w-9 font-mono text-2xl font-medium tabular-nums tracking-tight">{Math.round(p.score)}</span>
                    <TierDot tier={p.person.tier} />
                  </div>
                </td>
                <td className="py-4 pr-4"><div className="font-medium">{p.person.name}</div><div className="mt-0.5 text-[13px] text-mute">{p.person.title || '—'}</div></td>
                <td className="py-4 pr-4"><div>{p.company?.name}</div><div className="mt-0.5 text-[13px] text-mute">{p.company?.industry || p.company?.domain || '—'}</div></td>
                <td className="py-4 pr-8 font-mono tabular-nums text-mute">{p.company?.headcount != null ? p.company.headcount.toLocaleString() : '—'}</td>
                <td className="max-w-xs py-4 pr-4 text-[13px] leading-snug text-mute"><span className="line-clamp-2">{topSignal(p)}</span></td>
                <td className="py-4 text-right font-mono text-[11px] uppercase tracking-wider">{APPROVAL[p.approval]}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <ul className="md:hidden">
          {rows.map((p) => (
            <li key={p.id}>
              <button onClick={() => setOpenId(p.id)} className="flex w-full items-center gap-4 border-b border-line py-4 text-left">
                <span className="w-10 font-mono text-2xl font-medium tabular-nums">{Math.round(p.score)}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium">{p.person.name}</span>
                  <span className="block truncate text-[13px] text-mute">{p.person.title || '—'} · {p.company?.name}</span>
                </span>
                <TierDot tier={p.person.tier} />
              </button>
            </li>
          ))}
        </ul>

        {rows.length === 0 && <p className="border-t border-line py-16 text-center text-sm text-dim">{empty}</p>}
      </section>

      {open && <ProspectPanel key={open.id + open.approval} p={open} onClose={() => setOpenId(null)} onSave={save} />}
    </div>
  )
}
