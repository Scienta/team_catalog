import { useEffect, useRef, useState } from 'react'
import { collection, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, deleteField, addDoc, deleteDoc, getDocs, query, where, writeBatch } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'

// Two-level assignment model:
//   Level 1: consultant.clientId  — assigned to a client, no specific project
//   Level 2: project.consultantIds[] — assigned to a project (implies client via project.clientId)
// Effective client = project.clientId if in a project, else consultant.clientId
// Truly unassigned = not in any project AND no consultant.clientId

type Consultant = { id: string; name: string; photoUrl?: string; contractEnd?: string; isInternal?: boolean; clientId?: string }
type Project = { id: string; name: string; clientId: string; consultantIds?: string[] }
type Client = { id: string; name: string }

const COLORS = [
  { header: 'bg-violet-500', light: 'bg-violet-50 dark:bg-violet-950/40', border: 'border-violet-200 dark:border-violet-800', badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  { header: 'bg-sky-500', light: 'bg-sky-50 dark:bg-sky-950/40', border: 'border-sky-200 dark:border-sky-800', badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  { header: 'bg-emerald-500', light: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  { header: 'bg-amber-500', light: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400' },
  { header: 'bg-rose-500', light: 'bg-rose-50 dark:bg-rose-950/40', border: 'border-rose-200 dark:border-rose-800', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
  { header: 'bg-indigo-500', light: 'bg-indigo-50 dark:bg-indigo-950/40', border: 'border-indigo-200 dark:border-indigo-800', badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  { header: 'bg-teal-500', light: 'bg-teal-50 dark:bg-teal-950/40', border: 'border-teal-200 dark:border-teal-800', badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' },
  { header: 'bg-orange-500', light: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-200 dark:border-orange-800', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
]

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
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1 ${cls}`}>{d < 0 ? 'Utløpt' : `${d}d`}</span>
}

function ConsultantChip({ consultant, draggable: isDraggable, onDragStart, onClick }: {
  consultant: Consultant
  draggable?: boolean
  onDragStart?: () => void
  onClick: () => void
}) {
  return (
    <div
      draggable={isDraggable}
      onDragStart={isDraggable && onDragStart ? (e) => { e.dataTransfer.effectAllowed = 'move'; onDragStart() } : undefined}
      onClick={onClick}
      className={`flex items-center gap-2 bg-white dark:bg-[#222] border border-gray-100 dark:border-gray-700 rounded-xl px-2.5 py-1.5 transition-all select-none ${isDraggable ? 'cursor-grab active:cursor-grabbing hover:shadow-md hover:border-gray-300 dark:hover:border-gray-500' : 'cursor-pointer hover:shadow-sm'}`}
    >
      {consultant.photoUrl
        ? <img src={consultant.photoUrl} alt={consultant.name} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
        : <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-[10px] font-semibold text-gray-500 dark:text-gray-400 flex-shrink-0">{consultant.name?.charAt(0)}</div>
      }
      <span className="text-xs font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap">{consultant.name}</span>
      <ContractBadge contractEnd={consultant.contractEnd} />
    </div>
  )
}

function GroupCard({ title, color, consultants, isOver, isDraggable, isAlert, softHeader, onDelete, onDragOver, onDragLeave, onDrop, onDragStart, onConsultantClick }: {
  title: string
  color?: typeof COLORS[0]
  consultants: Consultant[]
  isOver: boolean
  isDraggable?: boolean
  isAlert?: boolean
  softHeader?: boolean
  onDelete?: () => void
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: () => void
  onDragStart: (consultantId: string) => void
  onConsultantClick: (id: string) => void
}) {
  const isGlobalAlert = isAlert && !softHeader

  return (
    <div className={`rounded-2xl border overflow-hidden transition-all ${
      isGlobalAlert
        ? 'border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20'
        : color
        ? `${color.border} ${color.light}`
        : 'border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40'
    } ${isOver ? 'ring-2 ring-blue-400 dark:ring-blue-500' : ''}`}>

      <div className={`px-4 py-3 ${
        isGlobalAlert
          ? 'bg-red-100/60 dark:bg-red-900/30'
          : softHeader && color
          ? `${color.header} opacity-50`
          : color
          ? color.header
          : 'bg-gray-200 dark:bg-gray-700'
      }`}>
        <div className="flex items-center gap-2">
          {isGlobalAlert && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />}
          <span className={`text-sm font-semibold flex-1 ${isGlobalAlert ? 'text-red-700 dark:text-red-400' : 'text-white'}`}>{title}</span>
          <span className={`text-xs ${isGlobalAlert ? 'text-red-400' : 'text-white/70'}`}>{consultants.length}</span>
          {onDelete && (
            <button onClick={(e) => { e.stopPropagation(); onDelete() }}
              className="ml-1 p-1 rounded-lg opacity-60 hover:opacity-100 hover:bg-black/20 transition-all"
              title="Slett kunde">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-white">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={(e) => { e.preventDefault(); onDrop() }}
        className={`p-3 flex flex-wrap gap-2 min-h-16 transition-colors ${isOver ? 'bg-blue-50 dark:bg-blue-950/20' : ''}`}
      >
        {consultants.map((c) => (
          <ConsultantChip
            key={c.id}
            consultant={c}
            draggable={isDraggable}
            onDragStart={() => onDragStart(c.id)}
            onClick={() => onConsultantClick(c.id)}
          />
        ))}
        {isOver && (
          <div className="border-2 border-dashed border-blue-300 dark:border-blue-700 rounded-xl px-4 py-2 flex items-center">
            <span className="text-xs text-blue-400">Slipp her</span>
          </div>
        )}
        {consultants.length === 0 && !isOver && (
          <span className="text-xs text-gray-300 dark:text-gray-700 italic self-center">Ingen konsulenter</span>
        )}
      </div>
    </div>
  )
}

export function BoardPage() {
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [view, setView] = useState<'client' | 'project'>('client')
  const [zoom, setZoom] = useState(1)
  const [dragging, setDragging] = useState<string | null>(null)
  const [dragOverId, setDragOverId] = useState<string | null>(null)
  const [addingProjectForClient, setAddingProjectForClient] = useState<string | null>(null)
  const [newProjectName, setNewProjectName] = useState('')
  const [addingClient, setAddingClient] = useState(false)
  const [newClientName, setNewClientName] = useState('')
  const [confirmDeleteClient, setConfirmDeleteClient] = useState<Client | null>(null)
  const [deleting, setDeleting] = useState(false)
  const addInputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'consultants'), (s) => setConsultants(s.docs.map((d) => ({ id: d.id, ...d.data() } as Consultant))))
    const u2 = onSnapshot(collection(db, 'projects'), (s) => setProjects(s.docs.map((d) => ({ id: d.id, ...d.data() } as Project))))
    const u3 = onSnapshot(collection(db, 'clients'), (s) => setClients(s.docs.map((d) => ({ id: d.id, ...d.data() } as Client))))
    return () => { u1(); u2(); u3() }
  }, [])

  const colorMap: Record<string, number> = {}
  clients.forEach((c, i) => { colorMap[c.id] = i })

  const inAnyProject = new Set(projects.flatMap((p) => p.consultantIds ?? []))

  // Truly unassigned: external, not in any project, no clientId
  const unassigned = consultants.filter((c) => !c.isInternal && !inAnyProject.has(c.id) && !c.clientId)
  const interne = consultants.filter((c) => c.isInternal).sort((a, b) => a.name.localeCompare(b.name))

  function findProjectId(consultantId: string): string | null {
    return projects.find((p) => p.consultantIds?.includes(consultantId))?.id ?? null
  }

  // All consultants visible under a client (project-assigned + direct clientId)
  function getClientConsultants(clientId: string): Consultant[] {
    const inProjectForClient = new Set(
      projects.filter((p) => p.clientId === clientId).flatMap((p) => p.consultantIds ?? [])
    )
    return consultants.filter((c) =>
      inProjectForClient.has(c.id) ||
      (c.clientId === clientId && !inAnyProject.has(c.id))
    )
  }

  // Consultants with direct clientId only (no project) — for "uten prosjekt" cards
  function getClientDirectConsultants(clientId: string): Consultant[] {
    return consultants.filter((c) => c.clientId === clientId && !inAnyProject.has(c.id))
  }

  function getProjectConsultants(project: Project): Consultant[] {
    return (project.consultantIds ?? [])
      .map((id) => consultants.find((c) => c.id === id))
      .filter(Boolean) as Consultant[]
  }

  type DropTarget =
    | { type: 'project'; projectId: string }
    | { type: 'client'; clientId: string }
    | { type: 'unassigned' }

  async function handleDrop(target: DropTarget) {
    if (!dragging) return
    const consultantId = dragging
    setDragging(null)
    setDragOverId(null)

    const fromProjectId = findProjectId(consultantId)
    const consultant = consultants.find((c) => c.id === consultantId)

    // Skip if nothing would change
    if (target.type === 'project' && fromProjectId === target.projectId && !consultant?.clientId) return
    if (target.type === 'client' && !fromProjectId && consultant?.clientId === target.clientId) return
    if (target.type === 'unassigned' && !fromProjectId && !consultant?.clientId) return

    const updates: Promise<void>[] = []

    // Remove from current project
    if (fromProjectId) {
      updates.push(updateDoc(doc(db, 'projects', fromProjectId), { consultantIds: arrayRemove(consultantId) }))
    }

    if (target.type === 'project') {
      // Add to new project and clear any direct clientId
      updates.push(updateDoc(doc(db, 'projects', target.projectId), { consultantIds: arrayUnion(consultantId) }))
      if (consultant?.clientId) {
        updates.push(updateDoc(doc(db, 'consultants', consultantId), { clientId: deleteField() }))
      }
    } else if (target.type === 'client') {
      // Assign directly to client (no project)
      updates.push(updateDoc(doc(db, 'consultants', consultantId), { clientId: target.clientId }))
    } else {
      // Completely unassign
      if (consultant?.clientId) {
        updates.push(updateDoc(doc(db, 'consultants', consultantId), { clientId: deleteField() }))
      }
    }

    await Promise.all(updates)
  }

  async function handleDeleteClient(client: Client) {
    setDeleting(true)
    const batch = writeBatch(db)

    // Delete all projects for this client
    const projectSnap = await getDocs(query(collection(db, 'projects'), where('clientId', '==', client.id)))
    projectSnap.docs.forEach((d) => batch.delete(d.ref))

    // Clear clientId from all consultants assigned to this client
    const consultantSnap = await getDocs(query(collection(db, 'consultants'), where('clientId', '==', client.id)))
    consultantSnap.docs.forEach((d) => batch.update(d.ref, { clientId: deleteField() }))

    // Delete the client itself
    batch.delete(doc(db, 'clients', client.id))

    await batch.commit()
    setConfirmDeleteClient(null)
    setDeleting(false)
  }

  async function handleAddProject(clientId: string) {
    const name = newProjectName.trim()
    if (!name) return
    await addDoc(collection(db, 'projects'), { name, clientId, consultantIds: [] })
    setAddingProjectForClient(null)
    setNewProjectName('')
  }

  async function handleAddClient() {
    const name = newClientName.trim()
    if (!name) return
    await addDoc(collection(db, 'clients'), { name })
    setAddingClient(false)
    setNewClientName('')
  }

  function startAddingProject(clientId: string) {
    setAddingProjectForClient(clientId)
    setNewProjectName('')
    setTimeout(() => addInputRef.current?.focus(), 50)
  }

  function startAddingClient() {
    setAddingClient(true)
    setNewClientName('')
    setTimeout(() => addInputRef.current?.focus(), 50)
  }

  const sortedClients = [...clients].sort((a, b) => getClientConsultants(b.id).length - getClientConsultants(a.id).length)

  function getSortedProjectsForClient(clientId: string) {
    return projects
      .filter((p) => p.clientId === clientId)
      .sort((a, b) => (b.consultantIds?.length ?? 0) - (a.consultantIds?.length ?? 0))
  }

  function dh(dropZoneId: string, target: DropTarget) {
    return {
      onDragOver: (e: React.DragEvent) => { e.preventDefault(); setDragOverId(dropZoneId) },
      onDragLeave: () => setDragOverId(null),
      onDrop: () => handleDrop(target),
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Delete confirmation modal */}
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Board</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
            {view === 'project' ? 'Dra konsulenter mellom prosjekter og kunder' : 'Dra konsulenter mellom kunder'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            <button onClick={() => setZoom((z) => Math.max(0.6, +(z - 0.1).toFixed(1)))} disabled={zoom <= 0.6}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-900 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 transition-all text-base font-medium">
              −
            </button>
            <span className="text-xs text-gray-400 dark:text-gray-600 w-8 text-center tabular-nums">{Math.round(zoom * 100)}%</span>
            <button onClick={() => setZoom((z) => Math.min(2, +(z + 0.1).toFixed(1)))} disabled={zoom >= 2}
              className="w-7 h-7 flex items-center justify-center rounded-lg text-gray-500 dark:text-gray-400 hover:bg-white dark:hover:bg-gray-900 hover:text-gray-900 dark:hover:text-white disabled:opacity-30 transition-all text-base font-medium">
              +
            </button>
          </div>
          <div className="flex bg-gray-100 dark:bg-gray-800 rounded-xl p-1">
            <button onClick={() => setView('client')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'client' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
              Etter kunde
            </button>
            <button onClick={() => setView('project')} className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${view === 'project' ? 'bg-white dark:bg-gray-900 text-gray-900 dark:text-white shadow-sm' : 'text-gray-500 dark:text-gray-400 hover:text-gray-700'}`}>
              Etter prosjekt
            </button>
          </div>
        </div>
      </div>

      <div style={{ zoom }}>
      {view === 'client' ? (
        // ── CLIENT VIEW: drag & drop assigns consultant.clientId ──
        <div style={{ columns: '280px', gap: '1rem' }}>
          {unassigned.length > 0 && (
            <div style={{ breakInside: 'avoid', marginBottom: '1rem' }}>
              <GroupCard
                title="Uten kunde"
                isAlert
                consultants={unassigned}
                isOver={dragOverId === 'unassigned'}
                isDraggable
                {...dh('unassigned', { type: 'unassigned' })}
                onDragStart={(id) => setDragging(id)}
                onConsultantClick={(id) => navigate(`/consultant/${id}`)}
              />
            </div>
          )}
          {sortedClients.map((client) => {
            const cons = getClientConsultants(client.id)
            const color = COLORS[colorMap[client.id] % COLORS.length]
            return (
              <div key={client.id} style={{ breakInside: 'avoid', marginBottom: '1rem' }}>
                <GroupCard
                  title={client.name}
                  color={color}
                  consultants={cons}
                  isOver={dragOverId === client.id}
                  isDraggable
                  onDelete={() => setConfirmDeleteClient(client)}
                  {...dh(client.id, { type: 'client', clientId: client.id })}
                  onDragStart={(id) => setDragging(id)}
                  onConsultantClick={(id) => navigate(`/consultant/${id}`)}
                />
              </div>
            )
          })}
          {interne.length > 0 && (
            <div style={{ breakInside: 'avoid', marginBottom: '1rem' }}>
              <GroupCard
                title="Interne ansatte"
                consultants={interne}
                isOver={false}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={() => {}}
                onDrop={() => {}}
                onDragStart={() => {}}
                onConsultantClick={(id) => navigate(`/consultant/${id}`)}
              />
            </div>
          )}
          {/* Add client */}
          <div style={{ breakInside: 'avoid', marginBottom: '1rem' }}>
            {addingClient ? (
              <div className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-3 flex gap-2">
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
            ) : (
              <button onClick={startAddingClient} className="w-full rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 py-3 text-xs font-medium text-gray-400 dark:text-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-all flex items-center justify-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Legg til kunde
              </button>
            )}
          </div>
        </div>
      ) : (
        // ── PROJECT VIEW: each client has "uten prosjekt" + their projects ──
        <div className="flex flex-col gap-8">
          {unassigned.length > 0 && (
            <div className="grid gap-3 items-start" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              <GroupCard
                title="Uten kunde"
                isAlert
                consultants={unassigned}
                isOver={dragOverId === 'unassigned'}
                isDraggable
                {...dh('unassigned', { type: 'unassigned' })}
                onDragStart={(id) => setDragging(id)}
                onConsultantClick={(id) => navigate(`/consultant/${id}`)}
              />
            </div>
          )}

          {interne.length > 0 && (
            <div className="grid gap-3 items-start" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
              <GroupCard
                title="Interne ansatte"
                consultants={interne}
                isOver={false}
                onDragOver={(e) => e.preventDefault()}
                onDragLeave={() => {}}
                onDrop={() => {}}
                onDragStart={() => {}}
                onConsultantClick={(id) => navigate(`/consultant/${id}`)}
              />
            </div>
          )}

          {sortedClients.map((client) => {

            const clientProjects = getSortedProjectsForClient(client.id)
            const directCons = getClientDirectConsultants(client.id)
            const totalCons = getClientConsultants(client.id).length
            const color = COLORS[colorMap[client.id] % COLORS.length]
            const noProjId = `noproj-${client.id}`

            return (
              <div key={client.id}>
                <div className="flex items-center gap-3 mb-3">
                  <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${color.badge}`}>{client.name}</span>
                  <div className="h-px flex-1 bg-gray-100 dark:bg-gray-800" />
                  <span className="text-xs text-gray-400 dark:text-gray-600">{totalCons} konsulenter</span>
                  <button onClick={() => setConfirmDeleteClient(client)} className="text-gray-300 dark:text-gray-700 hover:text-red-500 dark:hover:text-red-400 transition-colors" title="Slett kunde">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/>
                    </svg>
                  </button>
                </div>
                <div className="grid gap-3 items-start" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                  {/* Always-visible "uten prosjekt" drop zone for this client */}
                  <GroupCard
                    title="Ikke tildelt prosjekt"
                    color={color}
                    softHeader
                    consultants={directCons}
                    isOver={dragOverId === noProjId}
                    isDraggable
                    {...dh(noProjId, { type: 'client', clientId: client.id })}
                    onDragStart={(id) => setDragging(id)}
                    onConsultantClick={(id) => navigate(`/consultant/${id}`)}
                  />
                  {/* Project cards */}
                  {clientProjects.map((project) => (
                    <GroupCard
                      key={project.id}
                      title={project.name}
                      color={color}
                      consultants={getProjectConsultants(project)}
                      isOver={dragOverId === project.id}
                      isDraggable
                      {...dh(project.id, { type: 'project', projectId: project.id })}
                      onDragStart={(id) => setDragging(id)}
                      onConsultantClick={(id) => navigate(`/consultant/${id}`)}
                    />
                  ))}
                  {/* Add project card */}
                  {addingProjectForClient === client.id ? (
                    <div className="rounded-2xl border-2 border-dashed border-gray-300 dark:border-gray-600 p-3 flex flex-col gap-2 min-h-16 justify-center">
                      <input
                        ref={addInputRef}
                        value={newProjectName}
                        onChange={(e) => setNewProjectName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddProject(client.id); if (e.key === 'Escape') setAddingProjectForClient(null) }}
                        placeholder="Prosjektnavn…"
                        className="text-sm bg-transparent outline-none text-gray-800 dark:text-gray-200 placeholder-gray-300 dark:placeholder-gray-600"
                      />
                      <div className="flex gap-2">
                        <button onClick={() => handleAddProject(client.id)} className="text-xs font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors">Legg til</button>
                        <button onClick={() => setAddingProjectForClient(null)} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">Avbryt</button>
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => startAddingProject(client.id)} className="rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 min-h-16 text-xs font-medium text-gray-400 dark:text-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-all flex items-center justify-center gap-1.5">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                      Legg til prosjekt
                    </button>
                  )}
                </div>
              </div>
            )
          })}

          {/* Add client in project view */}
          <div>
            {addingClient ? (
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
            ) : (
              <button onClick={startAddingClient} className="w-full rounded-2xl border-2 border-dashed border-gray-200 dark:border-gray-800 py-3 text-xs font-medium text-gray-400 dark:text-gray-600 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-400 transition-all flex items-center justify-center gap-1.5">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Legg til kunde
              </button>
            )}
          </div>
        </div>
      )}
      </div>
    </div>
  )
}
