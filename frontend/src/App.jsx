import { useEffect, useState } from 'react'
import { api } from './api'
import NewCampaign from './NewCampaign'
import Campaign from './Campaign'

const STATUS_DOT = { done: 'bg-emerald-400', running: 'bg-amber-400 animate-pulse', queued: 'bg-slate-400', error: 'bg-rose-400' }

export default function App() {
  const [view, setView] = useState({ page: 'new' })
  const [campaigns, setCampaigns] = useState([])
  const [health, setHealth] = useState(null)

  const refresh = () => api.list().then(setCampaigns).catch(() => {})
  useEffect(() => {
    refresh()
    api.health().then(setHealth).catch(() => setHealth({ ok: false }))
    const t = setInterval(refresh, 4000)
    return () => clearInterval(t)
  }, [])

  return (
    <div className="flex h-full">
      <aside className="hidden w-72 shrink-0 flex-col border-r border-white/[0.06] bg-ink-900/60 md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-lg shadow-indigo-900/50">D</div>
          <div>
            <div className="text-[15px] font-semibold tracking-tight text-white">DealFlow</div>
            <div className="text-[11px] text-slate-500">Autonomous BD desk</div>
          </div>
        </div>
        <div className="px-3">
          <button className="btn-primary w-full" onClick={() => setView({ page: 'new' })}>+ New campaign</button>
        </div>
        <div className="label mt-6 px-5">Campaigns</div>
        <nav className="mt-2 flex-1 space-y-0.5 overflow-y-auto px-2 pb-4">
          {campaigns.length === 0 && <div className="px-3 py-2 text-xs text-slate-500">No campaigns yet.</div>}
          {campaigns.map((c) => (
            <button key={c.id} onClick={() => setView({ page: 'campaign', id: c.id })}
              className={`w-full rounded-lg px-3 py-2.5 text-left transition hover:bg-white/[0.04] ${view.id === c.id ? 'bg-white/[0.06]' : ''}`}>
              <div className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${STATUS_DOT[c.status] || 'bg-slate-500'}`} />
                <span className="truncate text-[13px] text-slate-200">{c.prompt}</span>
              </div>
              <div className="mt-1 pl-3.5 text-[11px] text-slate-500">{c.prospects} prospects · {c.approved} approved</div>
            </button>
          ))}
        </nav>
        <div className="border-t border-white/[0.06] px-5 py-3 text-[11px] text-slate-500">
          <div className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${health?.crustdata_key ? 'bg-emerald-400' : 'bg-rose-400'}`} />
            Crustdata {health?.crustdata_key ? 'connected' : health ? 'key missing' : 'checking…'}
          </div>
          <div className="mt-1">Drafts only. Nothing is ever sent.</div>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        {view.page === 'new'
          ? <NewCampaign onCreated={(id) => { refresh(); setView({ page: 'campaign', id }) }} health={health} />
          : <Campaign key={view.id} id={view.id} onChange={refresh} />}
      </main>
    </div>
  )
}
