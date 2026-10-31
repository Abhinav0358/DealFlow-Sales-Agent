import { useEffect, useState } from 'react'
import { fmtTime, Label, TierDot } from './ui'

function Section({ title, tag, children }) {
  return (
    <section className="border-t border-line py-7">
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <Label>{title}</Label>
        {tag && <Label className="text-mute">{tag}</Label>}
      </div>
      {children}
    </section>
  )
}

export default function ProspectPanel({ p, onClose, onSave }) {
  const [subject, setSubject] = useState(p.draft_subject)
  const [body, setBody] = useState(p.draft_body)
  const [saving, setSaving] = useState(false)
  const dirty = subject !== p.draft_subject || body !== p.draft_body
  const per = p.person, co = p.company || {}

  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const act = async (approval) => {
    setSaving(true)
    await onSave(p.id, { approval, ...(dirty ? { draft_subject: subject, draft_body: body } : {}) })
    setSaving(false)
  }

  return (
    <div className="anim-fade fixed inset-0 z-[60] flex justify-end bg-black/65" onClick={onClose}>
      <div className="anim-slide flex h-full w-full max-w-[640px] flex-col border-l border-line bg-bg" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-line px-6 py-3.5">
          <Label>Prospect · #{p.id}</Label>
          <button onClick={onClose} className="font-mono text-[11px] text-dim transition-colors hover:text-fg">ESC ✕</button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-4 pt-7">
          <div className="flex items-start justify-between gap-6">
            <div className="min-w-0">
              <h2 className="text-3xl font-medium leading-tight tracking-[-0.03em]">{per.name}</h2>
              <p className="mt-1.5 text-[15px] text-mute">{per.title || 'Title unavailable'} <span className="text-dim">·</span> {co.name}</p>
            </div>
            <div className="shrink-0 text-right">
              <div className="font-mono text-5xl font-medium leading-none tracking-tight tabular-nums">{Math.round(p.score)}</div>
              <div className="mt-2 flex items-center justify-end gap-2"><TierDot tier={per.tier} /><Label className="text-mute">{per.tier}</Label></div>
            </div>
          </div>
          <p className="mt-6 text-[15px] leading-relaxed text-mute">{p.explanation.summary}</p>

          <div className="mt-8">
            <Section title="Score breakdown" tag={`${Math.round(p.score)} / 100`}>
              <div className="space-y-5">
                {p.breakdown.map((b) => (
                  <div key={b.criterion}>
                    <div className="flex items-baseline justify-between">
                      <span className="text-sm">{b.criterion}</span>
                      <span className="font-mono text-sm tabular-nums">{b.points}<span className="text-dim"> / {b.max}</span></span>
                    </div>
                    <div className="mt-2 h-0.5 overflow-hidden bg-white/10">
                      <div className="bar-grow h-full bg-fg" style={{ width: `${(b.points / b.max) * 100}%` }} />
                    </div>
                    <p className="mt-2 text-[13px] leading-snug text-mute">
                      {b.reason}{b.field && <span className="ml-2 font-mono text-[10px] text-dim">{b.field}</span>}
                    </p>
                  </div>
                ))}
              </div>
            </Section>

            <Section title="Verified facts" tag="✓ From Crustdata">
              <dl>
                {p.explanation.facts.map((f, i) => (
                  <div key={i} className="grid grid-cols-[120px_1fr] gap-4 border-t border-line py-3 first:border-t-0 first:pt-0">
                    <dt className="text-[13px] text-dim">{f.label}</dt>
                    <dd className="min-w-0">
                      <div className="text-sm leading-snug">{String(f.value)}</div>
                      <div className="mt-1 truncate font-mono text-[10px] text-dim">
                        {f.field}
                        {f.source && <> · <a className="underline decoration-white/20 underline-offset-2 hover:text-fg" href={f.source} target="_blank" rel="noreferrer">source ↗</a></>}
                      </div>
                    </dd>
                  </div>
                ))}
              </dl>
              <p className="mt-4 font-mono text-[10px] leading-relaxed text-dim">
                Person · {p.source} · {fmtTime(p.fetched_at)}<br />Company · {p.company_source} · {fmtTime(p.company_fetched_at)}
              </p>
            </Section>

            <Section title="Inferences" tag="Inferred · not verified">
              {p.explanation.inferences.length === 0
                ? <p className="text-sm text-dim">Not enough data to draw inferences. Only verified facts are shown.</p>
                : <ul className="space-y-4">
                    {p.explanation.inferences.map((x, i) => (
                      <li key={i} className="border-l border-dashed border-white/25 pl-4">
                        <p className="text-sm leading-snug">{x.text}</p>
                        <p className="mt-1 font-mono text-[10px] text-dim">BASED ON · {x.based_on}</p>
                      </li>
                    ))}
                  </ul>}
            </Section>

            <Section title="Outreach draft" tag={p.explanation.draft_hooks?.length ? `Personalized · ${p.explanation.draft_hooks.join(', ')}` : 'Generic opener'}>
              <input className="field text-base font-medium" value={subject} onChange={(e) => setSubject(e.target.value)} />
              <textarea className="mt-4 min-h-60 w-full resize-y rounded-2xl border border-line bg-panel p-4 font-mono text-[13px] leading-relaxed text-fg outline-none transition-colors focus:border-white/25"
                value={body} onChange={(e) => setBody(e.target.value)} />
              <div className="mt-3 flex flex-wrap gap-5 text-[13px]">
                {per.profile_url && <a className="text-mute underline decoration-white/20 underline-offset-4 hover:text-fg" href={per.profile_url} target="_blank" rel="noreferrer">LinkedIn ↗</a>}
                {co.website && <a className="text-mute underline decoration-white/20 underline-offset-4 hover:text-fg" href={co.website} target="_blank" rel="noreferrer">{co.domain || 'Company site'} ↗</a>}
              </div>
            </Section>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-line bg-bg px-6 py-4">
          <Label className={p.approval === 'approved' ? 'text-fg' : 'text-dim'}>{p.approval === 'approved' ? '✓ Approved' : p.approval}</Label>
          <div className="flex gap-2">
            {dirty && <button className="pill-line" disabled={saving} onClick={() => act(p.approval)}>Save edits</button>}
            <button className="pill-line" disabled={saving || p.approval === 'rejected'} onClick={() => act('rejected')}>Reject</button>
            <button className="pill-solid" disabled={saving || (p.approval === 'approved' && !dirty)} onClick={() => act('approved')}>Approve draft</button>
          </div>
        </div>
      </div>
    </div>
  )
}
