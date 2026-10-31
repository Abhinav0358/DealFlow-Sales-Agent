const j = async (r) => {
  const data = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(data.error || `Request failed (${r.status})`)
  return data
}
export const api = {
  health: () => fetch('/api/health').then(j),
  parse: (body) => fetch('/api/parse', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(j),
  list: () => fetch('/api/campaigns').then(j),
  create: (body) => fetch('/api/campaigns', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(j),
  get: (id) => fetch(`/api/campaigns/${id}`).then(j),
  update: (id, body) => fetch(`/api/prospects/${id}`, { method: 'PATCH', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }).then(j),
  exportUrl: (id, all) => `/api/campaigns/${id}/export.csv${all ? '?all=1' : ''}`,
}
