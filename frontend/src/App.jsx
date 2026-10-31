import { useEffect, useState } from 'react'
import { api } from './api'
import NewCampaign from './NewCampaign'
import Campaign from './Campaign'
import { StatusDot, pad } from './ui'

const PanelIcon = () => (
  <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.25">
    <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2" /><path d="M6 3v10" />
  </svg>
)

function Wordmark({ slim }) {
  return slim
    ? <span className="text-[17px] font-semibold tracking-tight text-fg">D<span className="text-dim">f</span></span>
    : <span className="text-[19px] font-medium tracking-tight text-fg">Deal<span className="text-dim">flow</span></span>
}

export default function App() {
  const [view, setView] = useState({ page: 'new' })
  const [campaigns, setCampaigns] = useState([])
  const [health, setHealth] = useState(null)
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem('df.sidebar') === 'collapsed')
  const [mobileOpen, setMobileOpen] = useState(false)
  const slim = collapsed && !mobileOpen

  const refresh = () => api.list().then(setCampaigns).catch(() => {})
  useEffect(() => {
    refresh()
    api.health().then(setHealth).catch(() => setHealth({ ok: false }))
    const t = setInterval(refresh, 4000)
    return () => clearInterval(t)
  }, [])

  const toggle = () => setCollapsed((c) => { localStorage.setItem('df.sidebar', c ? 'open' : 'collapsed'); return !c })
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === '[' && !/INPUT|TEXTAREA/.test(document.activeElement?.tagName)) toggle()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const go = (v) => { setView(v); setMobileOpen(false) }
  const keyOk = health?.crustdata_key

  return (
    <div className="flex h-full">
      {mobileOpen && <div className="anim-fade fixed inset-0 z-40 bg-black/60 md:hidden" onClick={() => setMobileOpen(false)} />}

      <aside className={`fixed inset-y-0 left-0 z-50 flex shrink-0 flex-col border-r border-line bg-bg transition-[width,transform] duration-200 md:static md:translate-x-0 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} ${slim ? 'w-[68px]' : 'w-72'}`}>
        {slim ? (
          <div className="flex flex-col items-center gap-3 py-5">
            <Wordmark slim />
            <button onClick={toggle} title="Expand sidebar ( [ )" className="grid h-8 w-8 place-items-center rounded-md text-dim transition-colors hover:bg-white/[0.05] hover:text-fg"><PanelIcon /></button>
          </div>
        ) : (
          <div className="flex h-16 items-center justify-between px-5">
            <Wordmark />
            <button onClick={toggle} title="Collapse sidebar ( [ )" className="hidden h-8 w-8 place-items-center rounded-md text-dim transition-colors hover:bg-white/[0.05] hover:text-fg md:grid"><PanelIcon /></button>
          </div>
        )}

        <div className={slim ? 'flex justify-center pb-4' : 'px-5 pb-5'}>
          {slim
            ? <button onClick={() => go({ page: 'new' })} title="New campaign" className="grid h-9 w-9 place-items-center rounded-full bg-fg text-lg leading-none text-bg transition-colors hover:bg-white">+</button>
            : <button onClick={() => go({ page: 'new' })} className="pill-solid w-full">New campaign <span className="text-base leading-none">+</span></button>}
        </div>

        {!slim && <div className="label px-5 pb-2 text-dim">Campaigns</div>}
        <nav className="flex-1 overflow-y-auto border-t border-line">
          {campaigns.length === 0 && !slim && <div className="px-5 py-4 text-[13px] text-dim">No campaigns yet.</div>}
          {campaigns.map((c) => {
            const active = view.id === c.id
            return slim ? (
              <button key={c.id} title={c.prompt} onClick={() => go({ page: 'campaign', id: c.id })}
                className={`flex w-full flex-col items-center gap-1.5 border-b border-line py-3 transition-colors hover:bg-white/[0.03] ${active ? 'bg-white/[0.05]' : ''}`}>
                <StatusDot status={c.status} />
                <span className="font-mono text-[11px] text-mute">{pad(c.id)}</span>
              </button>
            ) : (
              <button key={c.id} onClick={() => go({ page: 'campaign', id: c.id })}
                className={`block w-full border-b border-line px-5 py-3.5 text-left transition-colors hover:bg-white/[0.03] ${active ? 'bg-white/[0.04] shadow-[inset_2px_0_0_0_#f2f3f5]' : ''}`}>
                <div className="flex items-center gap-2"><StatusDot status={c.status} /><span className="label text-dim">#{pad(c.id)}</span></div>
                <div className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-fg/90">{c.prompt}</div>
                <div className="mt-1.5 font-mono text-[11px] text-dim">{c.prospects} prospects · {c.approved} approved</div>
              </button>
            )
          })}
        </nav>

        <div className={`border-t border-line ${slim ? 'flex justify-center py-4' : 'px-5 py-4'}`}>
          {slim ? (
            <span title={keyOk ? 'Crustdata connected' : 'Crustdata key missing'} className={`h-1.5 w-1.5 rounded-full ${keyOk ? 'bg-fg/60' : 'bg-alert'}`} />
          ) : (
            <>
              <div className="flex items-center gap-2 font-mono text-[11px] text-mute">
                <span className={`h-1.5 w-1.5 rounded-full ${keyOk ? 'bg-fg/60' : health ? 'bg-alert' : 'bg-dim'}`} />
                Crustdata {keyOk ? 'connected' : health ? 'key missing' : 'checking…'}
              </div>
              <div className="mt-1.5 font-mono text-[11px] text-dim">Drafts only. Nothing is sent.</div>
            </>
          )}
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line px-5 md:hidden">
          <button onClick={() => setMobileOpen(true)} aria-label="Open menu" className="grid h-8 w-8 place-items-center rounded-md text-mute hover:bg-white/[0.05]"><PanelIcon /></button>
          <Wordmark />
        </header>
        <main className="min-w-0 flex-1 overflow-y-auto">
          {view.page === 'new'
            ? <NewCampaign onCreated={(id) => { refresh(); setView({ page: 'campaign', id }) }} health={health} />
            : <Campaign key={view.id} id={view.id} onChange={refresh} />}
        </main>
      </div>
    </div>
  )
}
