import { useEffect, useRef, useState } from 'react'
import { collection, onSnapshot, doc, deleteField, addDoc, getDocs, query, where, writeBatch } from 'firebase/firestore'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../firebase'

type Consultant = { id: string; name: string; photoUrl?: string; contractEnd?: string; isInternal?: boolean; sykemeldt?: boolean; permittert?: boolean; clientId?: string }
type Project = { id: string; name: string; clientId: string; consultantIds?: string[] }
type Client = { id: string; name: string; logoUrl?: string; contactPhotoUrl?: string; contactName?: string; slackChannel?: string }

function daysUntil(dateStr: string) {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const end = new Date(dateStr); end.setHours(0, 0, 0, 0)
  return Math.round((end.getTime() - today.getTime()) / 86400000)
}

function ContractBadge({ contractEnd }: { contractEnd?: string }) {
  if (!contractEnd) return null
  const d = daysUntil(contractEnd)
  if (d > 30) return null
  const cls = d <= 7
    ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
    : 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${cls}`}>{d < 0 ? 'Utløpt' : `${d}d`}</span>
}

function useFirestoreData() {
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'consultants'), (s) => setConsultants(s.docs.map((d) => ({ id: d.id, ...d.data() } as Consultant))))
    const u2 = onSnapshot(collection(db, 'projects'), (s) => setProjects(s.docs.map((d) => ({ id: d.id, ...d.data() } as Project))))
    const u3 = onSnapshot(collection(db, 'clients'), (s) => setClients(s.docs.map((d) => ({ id: d.id, ...d.data() } as Client))))
    return () => { u1(); u2(); u3() }
  }, [])

  return { consultants, projects, clients }
}

// ── Board overview — grid of client cards ────────────────────────────────────

function ClientCard({ client, consultants, projects, onClick }: {
  client: Client
  consultants: Consultant[]
  projects: Project[]
  onClick: () => void
}) {
  const inAnyProject = new Set(projects.flatMap((p) => p.consultantIds ?? []))
  const clientProjects = projects.filter((p) => p.clientId === client.id)
  const inClientProjects = new Set(clientProjects.flatMap((p) => p.consultantIds ?? []))
  const directConsultants = consultants.filter((c) => c.clientId === client.id && !inAnyProject.has(c.id))
  const totalConsultants = new Set([...inClientProjects, ...directConsultants.map((c) => c.id)]).size

  const allConsultantIds = [...inClientProjects, ...directConsultants.map((c) => c.id)]
  const expiring = allConsultantIds
    .map((id) => consultants.find((c) => c.id === id))
    .filter((c): c is Consultant => !!c?.contractEnd && daysUntil(c.contractEnd) <= 30)

  return (
    <button
      onClick={onClick}
      className="w-full h-full text-left rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] overflow-hidden transition-all hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
    >
      <div className="p-5 flex flex-col justify-between h-full">
        <div className="flex flex-col gap-3">
          <div className="flex justify-center pb-1">
            {client.logoUrl ? (
              <img src={client.logoUrl} alt={client.name} className="w-20 h-20 rounded-2xl object-contain" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-3xl font-bold text-gray-400 dark:text-gray-500">
                {client.name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="text-center">
            <p className="text-sm font-semibold text-gray-900 dark:text-white truncate">{client.name}</p>
            {client.slackChannel && (
              <p className="text-[11px] text-gray-400 dark:text-gray-600 mt-0.5">#{client.slackChannel}</p>
            )}
          </div>

          <div className="flex items-center justify-center gap-2 flex-wrap">
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
              {totalConsultants} konsulent{totalConsultants !== 1 ? 'er' : ''}
            </span>
            {clientProjects.length > 0 && (
              <span className="text-[11px] text-gray-400 dark:text-gray-600">
                {clientProjects.length} prosjekt{clientProjects.length !== 1 ? 'er' : ''}
              </span>
            )}
            {expiring.length > 0 && (
              <span className="text-[11px] font-medium text-red-500 dark:text-red-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-red-500 inline-block" />
                {expiring.length} utløper snart
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2 pt-3 mt-1 border-t border-gray-100 dark:border-gray-800 min-h-[32px]">
          {client.contactName ? (
            <>
              {client.contactPhotoUrl ? (
                <img src={client.contactPhotoUrl} alt={client.contactName} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 flex-shrink-0">
                  {client.contactName.charAt(0)}
                </div>
              )}
              <span className="text-xs text-gray-500 dark:text-gray-400 truncate">{client.contactName}</span>
            </>
          ) : (
            <span className="text-xs text-gray-300 dark:text-gray-700 italic">Ingen kontaktperson</span>
          )}
        </div>
      </div>
    </button>
  )
}

export function BoardPage() {
  const { consultants, projects, clients } = useFirestoreData()
  const [addingClient, setAddingClient] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [confirmDeleteClient, setConfirmDeleteClient] = useState<Client | null>(null)
  const [deleting, setDeleting] = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  const sortedClients = [...clients].sort((a, b) => a.name.localeCompare(b.name))

  async function handleAddClient() {
    const name = newClientName.trim()
    if (!name) return
    await addDoc(collection(db, 'clients'), { name })
    setAddingClient(false)
    setNewClientName('')
  }

  async function handleDeleteClient(client: Client) {
    setDeleting(true)
    try {
      const batch = writeBatch(db)
      const projectSnap = await getDocs(query(collection(db, 'projects'), where('clientId', '==', client.id)))
      projectSnap.docs.forEach((d) => batch.delete(d.ref))
      const consultantSnap = await getDocs(query(collection(db, 'consultants'), where('clientId', '==', client.id)))
      consultantSnap.docs.forEach((d) => batch.update(d.ref, { clientId: deleteField() }))
      batch.delete(doc(db, 'clients', client.id))
      await batch.commit()
      setConfirmDeleteClient(null)
    } catch (e) {
      console.error('Failed to delete client:', e)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {confirmDeleteClient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => !deleting && setConfirmDeleteClient(null)}>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600 dark:text-red-400">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Slett «{confirmDeleteClient.name}»?</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Dette kan ikke angres</p>
              </div>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 bg-gray-50 dark:bg-gray-800 rounded-xl p-3 mb-5">
              Alle prosjekter tilknyttet kunden slettes, og konsulenter mister sin kundetilknytning.
            </p>
            <div className="flex gap-2">
              <button onClick={() => handleDeleteClient(confirmDeleteClient)} disabled={deleting}
                className="flex-1 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                {deleting ? 'Sletter…' : 'Ja, slett kunden'}
              </button>
              <button onClick={() => setConfirmDeleteClient(null)} disabled={deleting}
                className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Board</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{sortedClients.length} kunder</p>
        </div>
        <button
          onClick={() => { setAddingClient(true); setTimeout(() => addInputRef.current?.focus(), 50) }}
          className="flex items-center gap-1.5 text-sm font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 px-3 py-2 rounded-xl transition-colors"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          Ny kunde
        </button>
      </div>

      {addingClient && (
        <div className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-3 flex gap-2 items-center">
          <input
            ref={addInputRef}
            value={newClientName}
            onChange={(e) => setNewClientName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddClient(); if (e.key === 'Escape') setAddingClient(false) }}
            placeholder="Kundenavn…"
            className="flex-1 text-sm bg-transparent outline-none text-gray-800 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600"
          />
          <button onClick={handleAddClient} className="text-xs font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Legg til</button>
          <button onClick={() => setAddingClient(false)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Avbryt</button>
        </div>
      )}

      {sortedClients.length === 0 && !addingClient ? (
        <div className="flex items-center justify-center h-48 text-sm text-gray-400 dark:text-gray-600">Ingen kunder ennå</div>
      ) : (
        <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}>
          {sortedClients.map((client) => (
            <div key={client.id} className="relative group/card h-full">
              <ClientCard
                client={client}
                consultants={consultants}
                projects={projects}
                onClick={() => navigate(`/board/${client.id}`)}
              />
              <button
                onClick={(e) => { e.stopPropagation(); setConfirmDeleteClient(client) }}
                className="absolute top-3 right-3 w-6 h-6 rounded-lg bg-white/80 dark:bg-gray-900/80 flex items-center justify-center opacity-0 group-hover/card:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-all"
                title="Slett kunde"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ── Tree diagram for a single client (read-only) ─────────────────────────────

function VLine() {
  return (
    <div className="flex justify-center h-8">
      <div className="w-px bg-gray-200 dark:bg-gray-700 h-full" />
    </div>
  )
}

function ConnectedRow({ items }: { items: React.ReactNode[] }) {
  const n = items.length
  if (n === 0) return null
  if (n === 1) {
    return (
      <div className="flex flex-col items-center">
        <div className="h-8 w-px bg-gray-200 dark:bg-gray-700" />
        {items[0]}
      </div>
    )
  }
  return (
    <div className="flex items-start">
      {items.map((item, i) => {
        const isFirst = i === 0
        const isLast = i === n - 1
        return (
          <div key={i} className="flex flex-col items-center">
            <div className="h-8 flex w-full">
              <div className={`flex-1 ${!isFirst ? 'border-t border-gray-200 dark:border-gray-700' : ''}`} />
              <div className="w-px shrink-0 bg-gray-200 dark:bg-gray-700" />
              <div className={`flex-1 ${!isLast ? 'border-t border-gray-200 dark:border-gray-700' : ''}`} />
            </div>
            <div className="px-3 flex flex-col items-center">{item}</div>
          </div>
        )
      })}
    </div>
  )
}

function ConsultantNode({ consultant, onClick }: { consultant: Consultant; onClick: () => void }) {
  return (
    <div onClick={onClick} className="flex flex-col items-center gap-1.5 cursor-pointer group w-20">
      <div className="relative">
        {consultant.photoUrl ? (
          <img src={consultant.photoUrl} alt={consultant.name} className={`w-12 h-12 rounded-full object-cover ring-2 ring-white dark:ring-gray-900 shadow-sm group-hover:ring-gray-300 dark:group-hover:ring-gray-600 transition-all ${consultant.sykemeldt ? 'opacity-60' : ''}`} />
        ) : (
          <div className={`w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-sm font-semibold text-gray-500 dark:text-gray-400 ring-2 ring-white dark:ring-gray-900 shadow-sm group-hover:ring-gray-300 transition-all ${consultant.sykemeldt ? 'opacity-60' : ''}`}>
            {consultant.name?.charAt(0)}
          </div>
        )}
        {consultant.sykemeldt && (
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-amber-400 border-2 border-white dark:border-gray-900 flex items-center justify-center text-[8px] leading-none">🤒</span>
        )}
        {consultant.permittert && !consultant.sykemeldt && (
          <span className="absolute -bottom-0.5 -right-0.5 w-4 h-4 rounded-full bg-blue-400 border-2 border-white dark:border-gray-900 flex items-center justify-center text-[8px] leading-none">🏠</span>
        )}
      </div>
      <div className="flex flex-col items-center gap-0.5 w-full">
        <span className="text-xs font-medium text-gray-700 dark:text-gray-300 text-center leading-tight line-clamp-2 w-full">{consultant.name}</span>
        {consultant.sykemeldt && <span className="text-[9px] font-semibold text-amber-600 dark:text-amber-400 uppercase tracking-wide">Sykemeldt</span>}
        {consultant.permittert && !consultant.sykemeldt && <span className="text-[9px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide">Permittert</span>}
        {consultant.contractEnd && <ContractBadge contractEnd={consultant.contractEnd} />}
      </div>
    </div>
  )
}

function ProjectNode({ name, count }: { name: string; count: number }) {
  return (
    <div className="bg-white dark:bg-[#222] border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 shadow-sm text-center min-w-[90px] max-w-[140px]">
      <p className="text-xs font-semibold text-gray-800 dark:text-gray-200 leading-snug">{name}</p>
      <p className="text-[10px] text-gray-400 dark:text-gray-600 mt-0.5">{count} konsulent{count !== 1 ? 'er' : ''}</p>
    </div>
  )
}

function ContactNode({ name, photoUrl }: { name: string; photoUrl?: string }) {
  const initials = name.split(' ').slice(0, 2).map((n) => n[0] ?? '').join('').toUpperCase()
  return (
    <div className="flex flex-col items-center gap-1.5">
      {photoUrl ? (
        <img src={photoUrl} alt={name} className="w-12 h-12 rounded-full object-cover shadow-sm ring-2 ring-white dark:ring-gray-900" />
      ) : (
        <div className="w-12 h-12 rounded-full bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center text-sm font-semibold text-sky-700 dark:text-sky-300 shadow-sm ring-2 ring-white dark:ring-gray-900">
          {initials || '?'}
        </div>
      )}
      <span className="text-xs text-gray-500 dark:text-gray-400 max-w-[100px] text-center leading-tight">{name}</span>
    </div>
  )
}

function ClientNode({ client, consultantCount }: { client: Client; consultantCount: number }) {
  return (
    <div className="bg-white dark:bg-[#1a1a1a] border border-gray-200 dark:border-gray-700 rounded-2xl p-5 shadow-sm flex flex-col items-center gap-3 min-w-[160px]">
      {client.logoUrl ? (
        <img src={client.logoUrl} alt={client.name} className="w-14 h-14 rounded-xl object-contain" />
      ) : (
        <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-xl font-bold text-white">
          {client.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="text-center">
        <p className="text-sm font-semibold text-gray-900 dark:text-white">{client.name}</p>
        <span className="inline-block mt-1.5 text-[10px] font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2.5 py-0.5 rounded-full">
          {consultantCount} konsulent{consultantCount !== 1 ? 'er' : ''}
        </span>
      </div>
      {client.slackChannel && (
        <div className="flex items-center gap-1 text-[10px] text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-gray-800/50 px-2.5 py-1 rounded-lg border border-gray-100 dark:border-gray-800">
          <span className="font-semibold">#</span>
          <span>{client.slackChannel}</span>
        </div>
      )}
    </div>
  )
}

function ProjectSubtree({ name, consultants, onConsultantClick }: {
  name: string
  consultants: Consultant[]
  onConsultantClick: (id: string) => void
}) {
  return (
    <div className="flex flex-col items-center">
      <ProjectNode name={name} count={consultants.length} />
      {consultants.length > 0 && (
        <>
          <VLine />
          <ConnectedRow items={consultants.map((c) => (
            <ConsultantNode key={c.id} consultant={c} onClick={() => onConsultantClick(c.id)} />
          ))} />
        </>
      )}
    </div>
  )
}

export function BoardClientPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const { consultants, projects, clients } = useFirestoreData()
  const navigate = useNavigate()

  const containerRef = useRef<HTMLDivElement>(null)
  const treeRef = useRef<HTMLDivElement>(null)
  const frameRef = useRef(0)
  const naturalSizeRef = useRef<{ w: number; h: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const [ready, setReady] = useState(false)

  const inAnyProject = new Set(projects.flatMap((p) => p.consultantIds ?? []))
  const client = clients.find((c) => c.id === clientId)
  const clientProjects = projects.filter((p) => p.clientId === clientId)
  const directConsultants = consultants.filter((c) => c.clientId === clientId && !inAnyProject.has(c.id))
  const inClientProjects = new Set(clientProjects.flatMap((p) => p.consultantIds ?? []))
  const totalCount = new Set([...inClientProjects, ...directConsultants.map((c) => c.id)]).size

  function getProjectConsultants(project: Project): Consultant[] {
    return (project.consultantIds ?? [])
      .map((id) => consultants.find((c) => c.id === id))
      .filter(Boolean) as Consultant[]
  }

  const branches = [
    ...clientProjects.map((p) => ({ key: p.id, name: p.name, consultants: getProjectConsultants(p) })),
    ...(directConsultants.length > 0 ? [{ key: 'direct', name: 'Uten prosjekt', consultants: directConsultants }] : []),
  ]

  // Re-measure natural size whenever tree structure changes (resets to zoom=1 temporarily)
  const branchSig = branches.map((b) => `${b.key}:${b.consultants.length}`).join('|')

  useEffect(() => {
    const container = containerRef.current
    const tree = treeRef.current
    if (!container || !tree) return

    cancelAnimationFrame(frameRef.current)
    frameRef.current = requestAnimationFrame(() => {
      // Measure natural (unscaled) size
      tree.style.zoom = '1'
      naturalSizeRef.current = { w: tree.scrollWidth, h: tree.scrollHeight }
      const cW = container.clientWidth
      const cH = container.clientHeight
      if (naturalSizeRef.current.w && naturalSizeRef.current.h && cW && cH) {
        const z = Math.min(cW / naturalSizeRef.current.w, cH / naturalSizeRef.current.h, 1) * 0.97
        setZoom(z)
        setReady(true)
      }
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [branchSig, client?.id])

  // Recalculate on container resize (window resize) without resetting zoom to 1
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let frame = 0
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => {
        const nat = naturalSizeRef.current
        if (!nat) return
        const cW = container.clientWidth
        const cH = container.clientHeight
        if (nat.w && nat.h && cW && cH) {
          setZoom(Math.min(cW / nat.w, cH / nat.h, 1) * 0.97)
        }
      })
    })
    ro.observe(container)
    return () => { cancelAnimationFrame(frame); ro.disconnect() }
  }, [])

  if (!client) return null

  return (
    <div className="flex flex-col" style={{ height: 'calc(100vh - 7.5rem)' }}>
      <div className="flex items-center gap-4 mb-4 flex-shrink-0">
        <button
          onClick={() => navigate('/board')}
          className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Board
        </button>
        <span className="text-gray-200 dark:text-gray-700">/</span>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{client.name}</h1>

        <div className="flex items-center gap-1.5 ml-auto bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
          <button
            onClick={() => setZoom((z) => Math.max(0.2, +(z - 0.05).toFixed(2)))}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700 transition-all"
            title="Mindre tekst"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
          <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 w-9 text-center select-none tabular-nums">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={() => setZoom((z) => Math.min(2, +(z + 0.05).toFixed(2)))}
            className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-700 transition-all"
            title="Større tekst"
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
          </button>
        </div>
      </div>

      <div ref={containerRef} className="flex-1 overflow-hidden flex justify-center">
        <div
          ref={treeRef}
          style={{ zoom, opacity: ready ? 1 : 0, transition: 'opacity 0.15s' }}
        >
          <div className="flex flex-col items-center min-w-max py-4 px-8">
            <ClientNode client={client} consultantCount={totalCount} />

            {client.contactName && (
              <>
                <VLine />
                <ContactNode name={client.contactName} photoUrl={client.contactPhotoUrl} />
              </>
            )}

            {branches.length > 0 ? (
              <>
                <VLine />
                <ConnectedRow
                  items={branches.map((branch) => (
                    <ProjectSubtree
                      key={branch.key}
                      name={branch.name}
                      consultants={branch.consultants}
                      onConsultantClick={(id) => navigate(`/consultant/${id}`)}
                    />
                  ))}
                />
              </>
            ) : (
              <div className="mt-8 text-sm text-gray-400 dark:text-gray-600 italic">Ingen konsulenter tilknyttet</div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
