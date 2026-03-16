import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { getIdToken } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { db, auth } from '../firebase'

type Consultant = { id: string; name: string; photoUrl?: string; contractEnd?: string; isInternal?: boolean }
type Project = { id: string; name: string; clientId: string; consultantIds?: string[] }
type Client = { id: string; name: string }

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const end = new Date(dateStr); end.setHours(0, 0, 0, 0)
  return Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function contractStatusStyle(days: number) {
  if (days <= 7) return { row: 'border-l-2 border-red-400 bg-red-50/60 dark:bg-red-950/30', badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400', label: days < 0 ? 'Utløpt' : `${days}d` }
  if (days <= 30) return { row: 'border-l-2 border-amber-400 bg-amber-50/60 dark:bg-amber-950/30', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400', label: `${days}d` }
  return { row: 'border-l-2 border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400', label: `${days}d` }
}

function contractBadge(c: Consultant) {
  if (!c.contractEnd) return null
  const d = daysUntil(c.contractEnd)
  if (d > 30) return null
  const cls = d < 0 || d <= 7
    ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
    : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
  return { cls, label: d < 0 ? 'Utløpt' : `${d}d` }
}

export function ConsultantListPage() {
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const [view, setView] = useState<'list' | 'tile'>('list')
  const [selectedClientIds, setSelectedClientIds] = useState<Set<string>>(new Set())
  const [selectedProjectIds, setSelectedProjectIds] = useState<Set<string>>(new Set())
  const [expandedClientIds, setExpandedClientIds] = useState<Set<string>>(new Set())
  const navigate = useNavigate()

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'consultants'), (s) => setConsultants(s.docs.map((d) => ({ id: d.id, ...d.data() } as Consultant))))
    const u2 = onSnapshot(collection(db, 'projects'), (s) => setProjects(s.docs.map((d) => ({ id: d.id, ...d.data() } as Project))))
    const u3 = onSnapshot(collection(db, 'clients'), (s) => setClients(s.docs.map((d) => ({ id: d.id, ...d.data() } as Client)).sort((a, b) => a.name.localeCompare(b.name))))
    return () => { u1(); u2(); u3() }
  }, [])

  async function handleSync() {
    setSyncing(true); setSyncMsg('')
    try {
      const token = await getIdToken(auth.currentUser!)
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/sync`, { method: 'POST', headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error()
      const { synced } = await res.json()
      setSyncMsg(`${synced} synkronisert`)
    } catch { setSyncMsg('Feilet') }
    finally { setSyncing(false) }
  }

  function getConsultantProjects(consultantId: string): Project[] {
    return projects.filter((p) => p.consultantIds?.includes(consultantId))
  }

  function getProjectNames(consultantId: string): string {
    const ps = getConsultantProjects(consultantId)
    return ps.length ? ps.map((p) => p.name).join(', ') : '–'
  }

  function getClientNames(consultantId: string): string {
    const ps = getConsultantProjects(consultantId)
    if (!ps.length) return '–'
    const clientIds = [...new Set(ps.map((p) => p.clientId).filter(Boolean))]
    return clientIds.map((cid) => clients.find((c) => c.id === cid)?.name).filter(Boolean).join(', ') || '–'
  }

  function getFilteredConsultants(): Consultant[] {
    if (selectedClientIds.size === 0) return consultants
    const includedProjectIds = new Set<string>()
    for (const clientId of selectedClientIds) {
      const clientProjects = projects.filter((p) => p.clientId === clientId)
      const checkedForClient = clientProjects.filter((p) => selectedProjectIds.has(p.id))
      if (checkedForClient.length > 0) checkedForClient.forEach((p) => includedProjectIds.add(p.id))
      else clientProjects.forEach((p) => includedProjectIds.add(p.id))
    }
    return consultants.filter((c) => getConsultantProjects(c.id).some((p) => includedProjectIds.has(p.id)))
  }

  function toggleClient(clientId: string) {
    setSelectedClientIds((prev) => {
      const next = new Set(prev)
      if (next.has(clientId)) {
        next.delete(clientId)
        setSelectedProjectIds((pp) => { const np = new Set(pp); projects.filter((p) => p.clientId === clientId).forEach((p) => np.delete(p.id)); return np })
        setExpandedClientIds((ep) => { const ne = new Set(ep); ne.delete(clientId); return ne })
      } else {
        next.add(clientId)
        setExpandedClientIds((ep) => new Set([...ep, clientId]))
      }
      return next
    })
  }

  function toggleProject(projectId: string) {
    setSelectedProjectIds((prev) => { const next = new Set(prev); next.has(projectId) ? next.delete(projectId) : next.add(projectId); return next })
  }

  function toggleExpanded(clientId: string) {
    setExpandedClientIds((prev) => { const next = new Set(prev); next.has(clientId) ? next.delete(clientId) : next.add(clientId); return next })
  }

  const filtered = getFilteredConsultants()
  const interne = filtered.filter((c) => c.isInternal).sort((a, b) => a.name.localeCompare(b.name))
  const active = filtered.filter((c) => !c.isInternal)
  const noProject = active.filter((c) => getConsultantProjects(c.id).length === 0).sort((a, b) => a.name.localeCompare(b.name))
  const withProject = active.filter((c) => getConsultantProjects(c.id).length > 0)
  const withContract = withProject.filter((c) => c.contractEnd).sort((a, b) => new Date(a.contractEnd!).getTime() - new Date(b.contractEnd!).getTime())
  const withoutContract = withProject.filter((c) => !c.contractEnd).sort((a, b) => a.name.localeCompare(b.name))
  const hasFilter = selectedClientIds.size > 0

  // ── Tile card ──────────────────────────────────────────────────────────────
  function TileCard({ c, alert }: { c: Consultant; alert?: boolean }) {
    const badge = c.contractEnd ? contractBadge(c) : null
    const projectName = getProjectNames(c.id)
    const clientName = getClientNames(c.id)
    return (
      <div
        onClick={() => navigate(`/consultant/${c.id}`)}
        className={`group cursor-pointer rounded-2xl border bg-white dark:bg-[#1a1a1a] shadow-sm hover:shadow-md transition-all flex flex-col items-center gap-3 p-5 ${
          alert ? 'border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20'
          : c.isInternal ? 'border-gray-100 dark:border-gray-800 opacity-70'
          : 'border-gray-100 dark:border-gray-800'
        }`}
      >
        {/* Photo */}
        <div className="relative">
          {c.photoUrl
            ? <img src={c.photoUrl} alt={c.name} className="w-16 h-16 rounded-full object-cover" />
            : <div className={`w-16 h-16 rounded-full flex items-center justify-center text-xl font-semibold ${alert ? 'bg-red-100 dark:bg-red-900/40 text-red-500' : 'bg-gray-100 dark:bg-gray-800 text-gray-400 dark:text-gray-600'}`}>{c.name?.charAt(0)}</div>
          }
          {alert && <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 ring-2 ring-white dark:ring-[#1a1a1a] animate-pulse" />}
          {badge && !alert && (
            <span className={`absolute -bottom-1 left-1/2 -translate-x-1/2 text-[10px] font-bold px-1.5 py-0.5 rounded-full ${badge.cls}`}>{badge.label}</span>
          )}
        </div>

        {/* Name */}
        <div className="text-center w-full">
          <p className={`text-sm font-semibold leading-tight ${alert ? 'text-red-700 dark:text-red-400' : 'text-gray-900 dark:text-white'}`}>{c.name}</p>
          {c.isInternal
            ? <p className="text-xs text-gray-300 dark:text-gray-700 mt-0.5">Intern</p>
            : alert
            ? <p className="text-xs text-red-400 dark:text-red-500 mt-0.5">Uten prosjekt</p>
            : (
              <>
                {clientName !== '–' && <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5 truncate">{clientName}</p>}
                {projectName !== '–' && <p className="text-xs text-gray-300 dark:text-gray-700 truncate">{projectName}</p>}
              </>
            )
          }
        </div>
      </div>
    )
  }

  return (
    <div className="flex gap-6 items-start">
      {/* Left sidebar filter */}
      <div className="w-52 flex-shrink-0 bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-4 transition-colors sticky top-20">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs font-medium text-gray-400 dark:text-gray-600 uppercase tracking-wider">Filtrer</span>
          {hasFilter && (
            <button onClick={() => { setSelectedClientIds(new Set()); setSelectedProjectIds(new Set()); setExpandedClientIds(new Set()) }}
              className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
              Nullstill
            </button>
          )}
        </div>
        <div className="flex flex-col gap-0.5">
          {clients.map((client) => {
            const clientProjects = projects.filter((p) => p.clientId === client.id)
            const isChecked = selectedClientIds.has(client.id)
            const isExpanded = expandedClientIds.has(client.id)
            return (
              <div key={client.id}>
                <div className="flex items-center gap-2 px-1 py-1.5 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                  <input type="checkbox" id={`client-${client.id}`} checked={isChecked} onChange={() => toggleClient(client.id)} className="rounded accent-gray-900 dark:accent-white flex-shrink-0" />
                  <label htmlFor={`client-${client.id}`} className="text-sm text-gray-700 dark:text-gray-300 cursor-pointer flex-1 leading-tight">{client.name}</label>
                  {clientProjects.length > 0 && isChecked && (
                    <button onClick={() => toggleExpanded(client.id)} className="text-gray-300 dark:text-gray-700 hover:text-gray-500 text-xs transition-colors">
                      {isExpanded ? '▲' : '▼'}
                    </button>
                  )}
                </div>
                {isChecked && isExpanded && clientProjects.length > 0 && (
                  <div className="ml-5 flex flex-col gap-0.5 mb-1">
                    {clientProjects.map((project) => (
                      <div key={project.id} className="flex items-center gap-2 px-1 py-1 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <input type="checkbox" id={`project-${project.id}`} checked={selectedProjectIds.has(project.id)} onChange={() => toggleProject(project.id)} className="rounded accent-gray-900 dark:accent-white flex-shrink-0" />
                        <label htmlFor={`project-${project.id}`} className="text-xs text-gray-500 dark:text-gray-500 cursor-pointer flex-1 leading-tight">{project.name}</label>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
          {clients.length === 0 && <p className="text-xs text-gray-400 dark:text-gray-600 px-1 py-2">Ingen kunder ennå</p>}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Konsulenter</h1>
            <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
              {hasFilter ? `${active.length} av ${consultants.filter((c) => !c.isInternal).length}` : `${consultants.filter((c) => !c.isInternal).length} konsulenter`}
              {interne.length > 0 && <span className="ml-2 text-gray-300 dark:text-gray-700">· {interne.length} interne</span>}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
              <button onClick={() => setView('list')} title="Listevisning"
                className={`p-1.5 rounded-lg transition-all ${view === 'list' ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600 hover:text-gray-600'}`}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/>
                  <line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/>
                </svg>
              </button>
              <button onClick={() => setView('tile')} title="Flisvisning"
                className={`p-1.5 rounded-lg transition-all ${view === 'tile' ? 'bg-white dark:bg-gray-900 shadow-sm text-gray-900 dark:text-white' : 'text-gray-400 dark:text-gray-600 hover:text-gray-600'}`}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
                  <rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/>
                </svg>
              </button>
            </div>

            {syncMsg && <span className="text-xs text-gray-400 dark:text-gray-500">{syncMsg}</span>}
            <button onClick={handleSync} disabled={syncing}
              className="flex items-center gap-2 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-40 text-white dark:text-gray-900 text-sm font-medium px-4 py-2 rounded-xl transition-colors">
              {syncing && <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/></svg>}
              Synkroniser
            </button>
          </div>
        </div>

        {/* ── TILE VIEW ─────────────────────────────────────────────────────── */}
        {view === 'tile' ? (
          <div className="flex flex-col gap-6">
            {!hasFilter && noProject.length > 0 && (
              <div>
                <p className="text-xs font-medium text-red-500 dark:text-red-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  Uten prosjekt
                </p>
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
                  {noProject.map((c) => <TileCard key={c.id} c={c} alert />)}
                </div>
              </div>
            )}
            {[...withContract, ...withoutContract].length > 0 && (
              <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
                {[...withContract, ...withoutContract].map((c) => <TileCard key={c.id} c={c} />)}
              </div>
            )}
            {interne.length > 0 && (
              <div>
                <p className="text-xs font-medium text-gray-400 dark:text-gray-600 uppercase tracking-wider mb-3">Interne ansatte</p>
                <div className="grid gap-3" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))' }}>
                  {interne.map((c) => <TileCard key={c.id} c={c} />)}
                </div>
              </div>
            )}
            {active.length === 0 && interne.length === 0 && (
              <p className="text-center text-sm text-gray-400 dark:text-gray-600 py-10">Ingen konsulenter matcher filteret</p>
            )}
          </div>
        ) : (
        /* ── LIST VIEW ────────────────────────────────────────────────────── */
        <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm transition-colors">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                {['Konsulent', 'Prosjekt', 'Kunde', 'Kontraktslutt', 'Status'].map((h) => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium text-gray-400 dark:text-gray-600 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {!hasFilter && noProject.map((c, i) => (
                <tr key={c.id} onClick={() => navigate(`/consultant/${c.id}`)}
                  className={`cursor-pointer transition-all hover:brightness-95 dark:hover:brightness-110 border-l-4 border-red-500 bg-red-50 dark:bg-red-950/40 ${i === 0 ? '' : 'border-t border-red-100 dark:border-red-900/30'}`}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {c.photoUrl ? <img src={c.photoUrl} alt={c.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" /> : <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center text-red-600 dark:text-red-400 font-medium text-xs flex-shrink-0">{c.name?.charAt(0)}</div>}
                      <span className="font-medium text-gray-900 dark:text-white">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-red-400 dark:text-red-500">–</td>
                  <td className="px-5 py-3.5 text-red-400 dark:text-red-500">–</td>
                  <td className="px-5 py-3.5 text-red-400 dark:text-red-500">{c.contractEnd ?? '–'}</td>
                  <td className="px-5 py-3.5">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-red-500 dark:bg-red-400 animate-pulse" />
                      Uten prosjekt
                    </span>
                  </td>
                </tr>
              ))}
              {!hasFilter && noProject.length > 0 && (withContract.length > 0 || withoutContract.length > 0) && (
                <tr><td colSpan={5} className="h-px bg-gray-100 dark:bg-gray-800 p-0" /></tr>
              )}
              {withContract.map((c) => {
                const days = daysUntil(c.contractEnd!)
                const { row, badge, label } = contractStatusStyle(days)
                return (
                  <tr key={c.id} onClick={() => navigate(`/consultant/${c.id}`)} className={`cursor-pointer transition-all hover:brightness-95 dark:hover:brightness-110 ${row}`}>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        {c.photoUrl ? <img src={c.photoUrl} alt={c.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" /> : <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 font-medium text-xs flex-shrink-0">{c.name?.charAt(0)}</div>}
                        <span className="font-medium text-gray-800 dark:text-gray-200">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400">{getProjectNames(c.id)}</td>
                    <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400">{getClientNames(c.id)}</td>
                    <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400">{c.contractEnd}</td>
                    <td className="px-5 py-3.5"><span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${badge}`}>{label}</span></td>
                  </tr>
                )
              })}
              {withoutContract.map((c, i) => (
                <tr key={c.id} onClick={() => navigate(`/consultant/${c.id}`)} className={`cursor-pointer transition-all hover:bg-gray-50/80 dark:hover:bg-gray-800/40 ${i === 0 && withContract.length > 0 ? 'border-t-2 border-gray-100 dark:border-gray-800' : ''}`}>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {c.photoUrl ? <img src={c.photoUrl} alt={c.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" /> : <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-600 font-medium text-xs flex-shrink-0">{c.name?.charAt(0)}</div>}
                      <span className="font-medium text-gray-600 dark:text-gray-400">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-400 dark:text-gray-600">{getProjectNames(c.id)}</td>
                  <td className="px-5 py-3.5 text-gray-400 dark:text-gray-600">{getClientNames(c.id)}</td>
                  <td className="px-5 py-3.5 text-gray-400 dark:text-gray-600">–</td>
                  <td className="px-5 py-3.5 text-gray-300 dark:text-gray-700 text-xs">Ingen kontrakt</td>
                </tr>
              ))}
              {interne.length > 0 && (
                <>
                  <tr><td colSpan={5} className="px-5 pt-5 pb-1"><span className="text-xs font-medium text-gray-400 dark:text-gray-600 uppercase tracking-wider">Interne ansatte</span></td></tr>
                  {interne.map((c) => (
                    <tr key={c.id} onClick={() => navigate(`/consultant/${c.id}`)}
                      className="cursor-pointer transition-all hover:bg-gray-50/80 dark:hover:bg-gray-800/40 border-t border-gray-100 dark:border-gray-800">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          {c.photoUrl ? <img src={c.photoUrl} alt={c.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0 opacity-60" /> : <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-600 font-medium text-xs flex-shrink-0">{c.name?.charAt(0)}</div>}
                          <span className="font-medium text-gray-500 dark:text-gray-500">{c.name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3.5 text-gray-300 dark:text-gray-700">–</td>
                      <td className="px-5 py-3.5 text-gray-300 dark:text-gray-700">–</td>
                      <td className="px-5 py-3.5 text-gray-300 dark:text-gray-700">–</td>
                      <td className="px-5 py-3.5"><span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600">Intern</span></td>
                    </tr>
                  ))}
                </>
              )}
              {active.length === 0 && interne.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-10 text-center text-sm text-gray-400 dark:text-gray-600">Ingen konsulenter matcher filteret</td></tr>
              )}
            </tbody>
          </table>
        </div>
        )}
      </div>
    </div>
  )
}
