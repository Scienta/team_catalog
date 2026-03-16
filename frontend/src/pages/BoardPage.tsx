import { useEffect, useState } from 'react'
import { collection, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove, deleteField } from 'firebase/firestore'
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

function GroupCard({ title, color, consultants, isOver, isDraggable, isAlert, softHeader, onDragOver, onDragLeave, onDrop, onDragStart, onConsultantClick }: {
  title: string
  color?: typeof COLORS[0]
  consultants: Consultant[]
  isOver: boolean
  isDraggable?: boolean
  isAlert?: boolean
  softHeader?: boolean  // use client color but dimmed, for per-client "uten prosjekt" card
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
  const [dragging, setDragging] = useState<string | null>(null) // consultantId
  const [dragOverId, setDragOverId] = useState<string | null>(null)
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Board</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">
            {view === 'project' ? 'Dra konsulenter mellom prosjekter og kunder' : 'Dra konsulenter mellom kunder'}
          </p>
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

      {view === 'client' ? (
        // ── CLIENT VIEW: drag & drop assigns consultant.clientId ──
        <div className="grid gap-4 items-start" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
          {unassigned.length > 0 && (
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
          )}
          {sortedClients.map((client) => {
            const cons = getClientConsultants(client.id)
            const color = COLORS[colorMap[client.id] % COLORS.length]
            return (
              <GroupCard
                key={client.id}
                title={client.name}
                color={color}
                consultants={cons}
                isOver={dragOverId === client.id}
                isDraggable
                {...dh(client.id, { type: 'client', clientId: client.id })}
                onDragStart={(id) => setDragging(id)}
                onConsultantClick={(id) => navigate(`/consultant/${id}`)}
              />
            )
          })}
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
                </div>
                <div className="grid gap-3 items-start" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
                  {/* Always-visible "uten prosjekt" drop zone for this client */}
                  <GroupCard
                    title="Uten prosjekt"
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
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
