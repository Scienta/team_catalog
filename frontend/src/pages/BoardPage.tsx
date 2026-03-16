import { useEffect, useState } from 'react'
import { collection, onSnapshot, doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'

type Consultant = { id: string; name: string; photoUrl?: string; contractEnd?: string }
type Project = { id: string; name: string; clientId: string; consultantIds?: string[] }
type Client = { id: string; name: string }

const CLIENT_COLORS = [
  { header: 'bg-violet-500', light: 'bg-violet-50 dark:bg-violet-950/40', border: 'border-violet-200 dark:border-violet-800', badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300' },
  { header: 'bg-sky-500', light: 'bg-sky-50 dark:bg-sky-950/40', border: 'border-sky-200 dark:border-sky-800', badge: 'bg-sky-100 text-sky-700 dark:bg-sky-900/40 dark:text-sky-300' },
  { header: 'bg-emerald-500', light: 'bg-emerald-50 dark:bg-emerald-950/40', border: 'border-emerald-200 dark:border-emerald-800', badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300' },
  { header: 'bg-amber-500', light: 'bg-amber-50 dark:bg-amber-950/40', border: 'border-amber-200 dark:border-amber-800', badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300' },
  { header: 'bg-rose-500', light: 'bg-rose-50 dark:bg-rose-950/40', border: 'border-rose-200 dark:border-rose-800', badge: 'bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300' },
  { header: 'bg-indigo-500', light: 'bg-indigo-50 dark:bg-indigo-950/40', border: 'border-indigo-200 dark:border-indigo-800', badge: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300' },
  { header: 'bg-teal-500', light: 'bg-teal-50 dark:bg-teal-950/40', border: 'border-teal-200 dark:border-teal-800', badge: 'bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300' },
  { header: 'bg-orange-500', light: 'bg-orange-50 dark:bg-orange-950/40', border: 'border-orange-200 dark:border-orange-800', badge: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300' },
]

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const end = new Date(dateStr); end.setHours(0, 0, 0, 0)
  return Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function ConsultantCard({
  consultant, onDragStart, onClick,
}: {
  consultant: Consultant
  onDragStart: () => void
  onClick: () => void
}) {
  const days = consultant.contractEnd ? daysUntil(consultant.contractEnd) : null
  const contractCls = days === null ? ''
    : days < 0 ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
    : days <= 7 ? 'bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400'
    : days <= 30 ? 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400'
    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400'
  const contractLabel = days === null ? null : days < 0 ? 'Utløpt' : `${days}d`

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = 'move'
        onDragStart()
      }}
      onClick={onClick}
      className="bg-white dark:bg-[#222] border border-gray-100 dark:border-gray-700 rounded-xl p-3 cursor-grab active:cursor-grabbing hover:shadow-md hover:border-gray-200 dark:hover:border-gray-600 transition-all select-none flex flex-col gap-2.5"
    >
      <div className="flex items-center gap-2.5">
        {consultant.photoUrl ? (
          <img src={consultant.photoUrl} alt={consultant.name} className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
        ) : (
          <div className="w-9 h-9 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 text-sm font-semibold flex-shrink-0">
            {consultant.name?.charAt(0)}
          </div>
        )}
        <span className="text-sm font-medium text-gray-800 dark:text-gray-200 leading-tight">{consultant.name}</span>
      </div>
      {contractLabel && (
        <div className="flex items-center justify-between">
          <span className="text-xs text-gray-400 dark:text-gray-600">{consultant.contractEnd}</span>
          <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-md ${contractCls}`}>{contractLabel}</span>
        </div>
      )}
    </div>
  )
}

function Column({
  title, subtitle, color, consultants, isOver,
  onDragOver, onDragLeave, onDrop, onConsultantDragStart, onConsultantClick,
}: {
  title: string
  subtitle?: string
  color?: typeof CLIENT_COLORS[0]
  consultants: Consultant[]
  isOver: boolean
  onDragOver: (e: React.DragEvent) => void
  onDragLeave: () => void
  onDrop: () => void
  onConsultantDragStart: (consultantId: string) => void
  onConsultantClick: (consultantId: string) => void
}) {
  const isUnassigned = !color

  return (
    <div className={`w-64 flex-shrink-0 flex flex-col rounded-2xl border overflow-hidden transition-all ${
      isUnassigned
        ? 'border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-950/20'
        : `${color!.border} ${color!.light}`
    } ${isOver ? 'ring-2 ring-blue-400 dark:ring-blue-500 ring-offset-1' : ''}`}>

      {/* Column header */}
      <div className={`px-4 py-3 ${isUnassigned ? 'bg-red-100/60 dark:bg-red-900/30' : color!.header}`}>
        {subtitle && <p className="text-[10px] font-medium text-white/70 uppercase tracking-wider mb-0.5">{subtitle}</p>}
        <div className="flex items-center justify-between">
          <span className={`text-sm font-semibold ${isUnassigned ? 'text-red-700 dark:text-red-400 flex items-center gap-1.5' : 'text-white'}`}>
            {isUnassigned && <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse inline-block" />}
            {title}
          </span>
          <span className={`text-xs ${isUnassigned ? 'text-red-400' : 'text-white/70'}`}>{consultants.length}</span>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={(e) => { e.preventDefault(); onDrop() }}
        className={`flex-1 p-3 flex flex-col gap-2 min-h-24 transition-colors ${
          isOver ? 'bg-blue-50/60 dark:bg-blue-950/20' : ''
        }`}
      >
        {consultants.map((c) => (
          <ConsultantCard
            key={c.id}
            consultant={c}
            onDragStart={() => onConsultantDragStart(c.id)}
            onClick={() => onConsultantClick(c.id)}
          />
        ))}
        {isOver && (
          <div className="border-2 border-dashed border-blue-300 dark:border-blue-600 rounded-xl h-16 flex items-center justify-center">
            <span className="text-xs text-blue-400 dark:text-blue-500">Slipp her</span>
          </div>
        )}
        {consultants.length === 0 && !isOver && (
          <div className="border border-dashed border-gray-200 dark:border-gray-700 rounded-xl h-16 flex items-center justify-center">
            <span className="text-xs text-gray-300 dark:text-gray-700">Dra hit</span>
          </div>
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
  const [dragging, setDragging] = useState<{ consultantId: string; fromProjectId: string | null } | null>(null)
  const [dragOverCol, setDragOverCol] = useState<string | null>(null) // projectId or 'unassigned'
  const navigate = useNavigate()

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'consultants'), (s) => setConsultants(s.docs.map((d) => ({ id: d.id, ...d.data() } as Consultant))))
    const u2 = onSnapshot(collection(db, 'projects'), (s) => setProjects(s.docs.map((d) => ({ id: d.id, ...d.data() } as Project))))
    const u3 = onSnapshot(collection(db, 'clients'), (s) => setClients(s.docs.map((d) => ({ id: d.id, ...d.data() } as Client)).sort((a, b) => a.name.localeCompare(b.name))))
    return () => { u1(); u2(); u3() }
  }, [])

  const clientColorMap: Record<string, number> = {}
  clients.forEach((c, i) => { clientColorMap[c.id] = i })

  const assignedIds = new Set(projects.flatMap((p) => p.consultantIds ?? []))
  const unassigned = consultants.filter((c) => !assignedIds.has(c.id))

  async function handleDrop(toProjectId: string | null) {
    if (!dragging) return
    const { consultantId, fromProjectId } = dragging
    setDragging(null)
    setDragOverCol(null)

    if (fromProjectId === toProjectId) return

    // Remove from old project
    if (fromProjectId) {
      await updateDoc(doc(db, 'projects', fromProjectId), { consultantIds: arrayRemove(consultantId) })
    }
    // Add to new project
    if (toProjectId) {
      await updateDoc(doc(db, 'projects', toProjectId), { consultantIds: arrayUnion(consultantId) })
    }
  }

  function getProjectConsultants(project: Project) {
    return (project.consultantIds ?? []).map((id) => consultants.find((c) => c.id === id)).filter(Boolean) as Consultant[]
  }

  // Group projects by client for client view
  const clientsWithProjects = clients.map((client) => ({
    client,
    projects: projects.filter((p) => p.clientId === client.id),
    colorIdx: clientColorMap[client.id] ?? 0,
  })).filter((g) => g.projects.length > 0)

  return (
    <div className="flex flex-col gap-5 h-full">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Board</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Dra konsulenter mellom prosjekter</p>
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

      {/* Board — horizontal scroll */}
      <div
        className="overflow-x-auto overflow-y-auto pb-6 -mx-6 px-6 flex-1"
        onMouseUp={() => { setDragging(null); setDragOverCol(null) }}
      >
        <div className="flex gap-4 items-start" style={{ minWidth: 'max-content' }}>
          {/* Unassigned column always first */}
          {unassigned.length > 0 && (
            <Column
              title="Uten prosjekt"
              consultants={unassigned}
              isOver={dragOverCol === 'unassigned'}
              onDragOver={(e) => { e.preventDefault(); setDragOverCol('unassigned') }}
              onDragLeave={() => setDragOverCol(null)}
              onDrop={() => handleDrop(null)}
              onConsultantDragStart={(id) => setDragging({ consultantId: id, fromProjectId: null })}
              onConsultantClick={(id) => navigate(`/consultant/${id}`)}
            />
          )}

          {view === 'client'
            ? clientsWithProjects.map(({ client, projects: cProjects, colorIdx }) => (
                cProjects.map((project) => (
                  <Column
                    key={project.id}
                    title={project.name}
                    subtitle={client.name}
                    color={CLIENT_COLORS[colorIdx % CLIENT_COLORS.length]}
                    consultants={getProjectConsultants(project)}
                    isOver={dragOverCol === project.id}
                    onDragOver={(e) => { e.preventDefault(); setDragOverCol(project.id) }}
                    onDragLeave={() => setDragOverCol(null)}
                    onDrop={() => handleDrop(project.id)}
                    onConsultantDragStart={(id) => setDragging({ consultantId: id, fromProjectId: project.id })}
                    onConsultantClick={(id) => navigate(`/consultant/${id}`)}
                  />
                ))
              ))
            : projects.map((project) => {
                const colorIdx = clientColorMap[project.clientId] ?? 0
                const client = clients.find((c) => c.id === project.clientId)
                return (
                  <Column
                    key={project.id}
                    title={project.name}
                    subtitle={client?.name}
                    color={CLIENT_COLORS[colorIdx % CLIENT_COLORS.length]}
                    consultants={getProjectConsultants(project)}
                    isOver={dragOverCol === project.id}
                    onDragOver={(e) => { e.preventDefault(); setDragOverCol(project.id) }}
                    onDragLeave={() => setDragOverCol(null)}
                    onDrop={() => handleDrop(project.id)}
                    onConsultantDragStart={(id) => setDragging({ consultantId: id, fromProjectId: project.id })}
                    onConsultantClick={(id) => navigate(`/consultant/${id}`)}
                  />
                )
              })
          }
        </div>
      </div>
    </div>
  )
}
