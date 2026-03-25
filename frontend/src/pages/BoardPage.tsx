import { useEffect, useRef, useState } from 'react'
import { collection, onSnapshot, doc, getDoc, updateDoc, deleteField, addDoc, getDocs, query, where, writeBatch } from 'firebase/firestore'
import { useNavigate, useParams } from 'react-router-dom'
import { db } from '../firebase'
import { writeAuditLog } from '../lib/auditLog'

type AbsencePeriod = { fra: string; til: string | null }

function isActiveNow(periods: AbsencePeriod[]): boolean {
  const today = new Date().toISOString().split('T')[0]
  return periods.some(p => p.fra <= today && (p.til === null || p.til >= today))
}

type Consultant = { id: string; name: string; photoUrl?: string; contractEnd?: string; isInternal?: boolean; sykemeldt?: boolean; permittert?: boolean; sykemeldtPerioder?: AbsencePeriod[]; permittertPerioder?: AbsencePeriod[]; clientId?: string }
type Project = { id: string; name: string; clientId: string; consultantIds?: string[]; contactName?: string; contactEmail?: string; contactPhone?: string; contactPhotoUrl?: string }
type Client = { id: string; name: string; logoUrl?: string; contactPhotoUrl?: string; contactName?: string; contactEmail?: string; contactPhone?: string; slackChannel?: string }

async function startLedigIfNoProject(consultantId: string) {
  const today = new Date().toISOString().split('T')[0]
  const remaining = await getDocs(query(collection(db, 'projects'), where('consultantIds', 'array-contains', consultantId)))
  if (!remaining.empty) return
  const snap = await getDoc(doc(db, 'consultants', consultantId))
  if (!snap.exists()) return
  const existing = (snap.data()?.ledigPerioder ?? []) as AbsencePeriod[]
  if (existing.some(p => p.til === null)) return
  await updateDoc(doc(db, 'consultants', consultantId), { ledigPerioder: [...existing, { fra: today, til: null }] })
}

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

// ── Board overview ────────────────────────────────────────────────────────────

function formatContractDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function ConsultantCard({ consultant, projectName, onClick }: { consultant: Consultant; projectName: string; onClick: () => void }) {
  const isSykemeldt = isActiveNow(consultant.sykemeldtPerioder ?? []) || (!consultant.sykemeldtPerioder && consultant.sykemeldt)
  const isPermittert = isActiveNow(consultant.permittertPerioder ?? []) || (!consultant.permittertPerioder && consultant.permittert)
  return (
    <button onClick={onClick} className="flex items-center gap-5 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-5 text-left hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors w-full">
      <div className="relative flex-shrink-0">
        {consultant.photoUrl ? (
          <img src={consultant.photoUrl} alt={consultant.name} className={`w-16 h-16 rounded-full object-cover ${isSykemeldt ? 'opacity-60' : ''}`} />
        ) : (
          <div className={`w-16 h-16 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-xl font-semibold text-gray-500 dark:text-gray-400 ${isSykemeldt ? 'opacity-60' : ''}`}>
            {consultant.name?.charAt(0)}
          </div>
        )}
        {isSykemeldt && (
          <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-amber-400 border-2 border-white dark:border-gray-900 flex items-center justify-center text-[10px]">🤒</span>
        )}
        {isPermittert && !isSykemeldt && (
          <span className="absolute -bottom-0.5 -right-0.5 w-5 h-5 rounded-full bg-blue-400 border-2 border-white dark:border-gray-900 flex items-center justify-center text-[10px]">🏠</span>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-base font-semibold text-gray-900 dark:text-white truncate">{consultant.name}</p>
        <p className="text-base text-gray-500 dark:text-gray-400 truncate mt-0.5">{projectName}</p>
        {consultant.contractEnd && (
          <div className="flex items-center gap-1.5 mt-1.5">
            <ContractBadge contractEnd={consultant.contractEnd} />
            <span className="text-sm text-gray-400 dark:text-gray-500">til {formatContractDate(consultant.contractEnd)}</span>
          </div>
        )}
        {isSykemeldt && <p className="text-sm font-medium text-amber-600 dark:text-amber-400 mt-1">Sykemeldt</p>}
        {isPermittert && !isSykemeldt && <p className="text-sm font-medium text-blue-600 dark:text-blue-400 mt-1">Permittert</p>}
      </div>
    </button>
  )
}

// ── Client selector tile ──────────────────────────────────────────────────────

function ClientTile({ client, consultantCount, projectCount, onClick, onDelete }: {
  client: Client
  consultantCount: number
  projectCount: number
  onClick: () => void
  onDelete: () => void
}) {
  return (
    <button
      onClick={onClick}
      className="relative group/tile w-full text-left rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] p-5 flex items-center gap-5 hover:shadow-lg hover:border-violet-200 dark:hover:border-violet-800 hover:-translate-y-0.5 transition-all active:translate-y-0"
    >
      {client.logoUrl ? (
        <img src={client.logoUrl} alt={client.name} className="w-16 h-16 rounded-2xl object-contain flex-shrink-0 shadow-sm" />
      ) : (
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-2xl font-bold text-white flex-shrink-0 shadow-sm">
          {client.name.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-lg font-semibold text-gray-900 dark:text-white truncate">{client.name}</p>
        <div className="flex items-center gap-2 mt-1 flex-wrap">
          <span className="text-sm font-medium bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 px-2.5 py-0.5 rounded-full">
            {consultantCount} konsulent{consultantCount !== 1 ? 'er' : ''}
          </span>
          {projectCount > 0 && (
            <span className="text-sm text-gray-400 dark:text-gray-600">
              {projectCount} prosjekt{projectCount !== 1 ? 'er' : ''}
            </span>
          )}
          {client.contactName && (
            <span className="text-sm text-gray-400 dark:text-gray-600 truncate">{client.contactName}</span>
          )}
        </div>
      </div>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 dark:text-gray-700 flex-shrink-0">
        <polyline points="9 18 15 12 9 6"/>
      </svg>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onDelete() }}
        className="absolute top-3 right-3 w-6 h-6 rounded-lg flex items-center justify-center opacity-0 group-hover/tile:opacity-100 hover:bg-red-50 dark:hover:bg-red-900/30 text-gray-400 hover:text-red-500 transition-all"
        title="Slett kunde"
      >
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
        </svg>
      </button>
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
      const affectedConsultantIds = [...new Set(projectSnap.docs.flatMap(d => (d.data().consultantIds ?? []) as string[]))]
      projectSnap.docs.forEach((d) => batch.delete(d.ref))
      const consultantSnap = await getDocs(query(collection(db, 'consultants'), where('clientId', '==', client.id)))
      consultantSnap.docs.forEach((d) => batch.update(d.ref, { clientId: deleteField() }))
      batch.delete(doc(db, 'clients', client.id))
      await batch.commit()
      await Promise.all(affectedConsultantIds.map(startLedigIfNoProject))
      await writeAuditLog('DELETE_CLIENT', 'client', client.id, { name: client.name })
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
        <div className="flex flex-col gap-3">
          {(() => {
            const inAnyProject = new Set(projects.flatMap((p) => p.consultantIds ?? []))
            return sortedClients.map((client) => {
              const clientProjects = projects.filter((p) => p.clientId === client.id)
              const directCount = consultants.filter((c) => c.clientId === client.id && !inAnyProject.has(c.id)).length
              const consultantsInProjects = new Set(clientProjects.flatMap((p) => p.consultantIds ?? [])).size
              return (
                <ClientTile
                  key={client.id}
                  client={client}
                  consultantCount={directCount + consultantsInProjects}
                  projectCount={clientProjects.length}
                  onClick={() => navigate(`/board/${client.id}`)}
                  onDelete={() => setConfirmDeleteClient(client)}
                />
              )
            })
          })()}
        </div>
      )}
    </div>
  )
}

// ── Client detail page — project oriented ─────────────────────────────────────

export function BoardClientPage() {
  const { clientId } = useParams<{ clientId: string }>()
  const { consultants, projects, clients } = useFirestoreData()
  const navigate = useNavigate()

  const client = clients.find((c) => c.id === clientId)
  const clientProjects = projects.filter((p) => p.clientId === clientId)
  const inAnyProject = new Set(projects.flatMap((p) => p.consultantIds ?? []))
  const directConsultants = consultants.filter((c) => c.clientId === clientId && !inAnyProject.has(c.id))

  const groups: { project: Project | null; consultants: Consultant[] }[] = [
    ...clientProjects.map((p) => ({
      project: p,
      consultants: (p.consultantIds ?? [])
        .map((id) => consultants.find((c) => c.id === id))
        .filter((c): c is Consultant => !!c),
    })).filter((g) => g.consultants.length > 0),
    ...(directConsultants.length > 0 ? [{ project: null, consultants: directConsultants }] : []),
  ]

  if (!client) return (
    <div className="flex items-center justify-center h-48 text-sm text-gray-400 dark:text-gray-600">Laster…</div>
  )

  const totalConsultants = groups.reduce((s, g) => s + g.consultants.length, 0)

  return (
    <div className="flex flex-col gap-6">
      {/* Back */}
      <button
        onClick={() => navigate('/board')}
        className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors w-fit"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="15 18 9 12 15 6"/>
        </svg>
        Alle kunder
      </button>

      {/* Client header */}
      <div
        className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] overflow-hidden cursor-pointer hover:shadow-lg transition-all"
        onClick={() => navigate(`/clients/${clientId}`)}
      >
        <div className="h-2 bg-gradient-to-r from-violet-500 via-purple-500 to-indigo-500" />
        <div className="p-8 flex items-start gap-7">
          {client.logoUrl ? (
            <img src={client.logoUrl} alt={client.name} className="w-24 h-24 rounded-2xl object-contain flex-shrink-0 shadow-sm" />
          ) : (
            <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-4xl font-bold text-white flex-shrink-0 shadow-sm">
              {client.name.charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{client.name}</h1>
                <div className="flex items-center gap-3 mt-2 flex-wrap">
                  {client.slackChannel && (
                    <span className="text-sm text-gray-400 dark:text-gray-500 font-medium">#{client.slackChannel}</span>
                  )}
                  <span className="text-sm font-semibold bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300 px-3 py-1 rounded-full">
                    {totalConsultants} konsulent{totalConsultants !== 1 ? 'er' : ''}
                  </span>
                  <span className="text-sm text-gray-400 dark:text-gray-500">
                    {clientProjects.length} prosjekt{clientProjects.length !== 1 ? 'er' : ''}
                  </span>
                </div>
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-600 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-xl border border-gray-100 dark:border-gray-700 whitespace-nowrap flex-shrink-0">
                Rediger kunde →
              </span>
            </div>

            {client.contactName && (
              <div className="mt-5 flex items-center gap-4 bg-gray-50 dark:bg-gray-800/50 rounded-xl p-4 w-fit">
                {client.contactPhotoUrl ? (
                  <img src={client.contactPhotoUrl} alt={client.contactName} className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-sky-100 dark:bg-sky-900/40 flex items-center justify-center text-base font-semibold text-sky-700 dark:text-sky-300 flex-shrink-0">
                    {client.contactName.charAt(0)}
                  </div>
                )}
                <div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide text-[11px] mb-0.5">Kundekontakt</p>
                  <p className="text-base font-semibold text-gray-800 dark:text-gray-200">{client.contactName}</p>
                  <div className="flex items-center gap-4 flex-wrap mt-0.5">
                    {client.contactEmail && <span className="text-sm text-gray-400 dark:text-gray-500">{client.contactEmail}</span>}
                    {client.contactPhone && <span className="text-sm text-gray-400 dark:text-gray-500">{client.contactPhone}</span>}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Project sections */}
      {groups.length > 0 ? (
        <div className="flex flex-col gap-5">
          {groups.map(({ project, consultants: groupConsultants }) => {
            const projectName = project?.name ?? 'Uten prosjekt'
            return (
              <div key={project?.id ?? 'direct'} className="rounded-2xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1a1a] overflow-hidden shadow-sm">
                {/* Project header */}
                <div className="px-7 py-5 bg-gray-50 dark:bg-gray-800/60 border-b border-gray-200 dark:border-gray-700">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-4">
                      {/* Client logo next to project name */}
                      {client.logoUrl ? (
                        <img src={client.logoUrl} alt={client.name} className="w-10 h-10 rounded-xl object-contain flex-shrink-0 opacity-80" />
                      ) : (
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-base font-bold text-white flex-shrink-0">
                          {client.name.charAt(0).toUpperCase()}
                        </div>
                      )}
                      <div>
                        <h2 className="text-lg font-bold text-gray-900 dark:text-white">{projectName}</h2>
                        <span className="text-sm text-gray-400 dark:text-gray-500">
                          {groupConsultants.length} konsulent{groupConsultants.length !== 1 ? 'er' : ''}
                        </span>
                      </div>
                    </div>

                    {/* Project contact */}
                    {project?.contactName && (
                      <div className="flex items-center gap-3 bg-white dark:bg-gray-800 rounded-xl px-4 py-2.5 border border-gray-200 dark:border-gray-700 flex-shrink-0">
                        {project.contactPhotoUrl ? (
                          <img src={project.contactPhotoUrl} alt={project.contactName} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex-shrink-0">
                            {project.contactName.charAt(0)}
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-[11px] text-gray-400 dark:text-gray-500 uppercase tracking-wide font-medium">Prosjektkontakt</p>
                          <p className="text-sm font-semibold text-gray-800 dark:text-gray-200 truncate">{project.contactName}</p>
                          <div className="flex items-center gap-2 flex-wrap">
                            {project.contactEmail && <span className="text-xs text-gray-400 dark:text-gray-500 truncate">{project.contactEmail}</span>}
                            {project.contactPhone && <span className="text-xs text-gray-400 dark:text-gray-500">{project.contactPhone}</span>}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Consultants */}
                <div className="p-7 grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                  {groupConsultants.map((consultant) => (
                    <ConsultantCard
                      key={consultant.id}
                      consultant={consultant}
                      projectName={projectName}
                      onClick={() => navigate(`/consultant/${consultant.id}`)}
                    />
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="flex items-center justify-center h-32 text-base text-gray-400 dark:text-gray-600 italic">Ingen konsulenter tilknyttet</div>
      )}
    </div>
  )
}
