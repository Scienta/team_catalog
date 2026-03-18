import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { doc, onSnapshot, updateDoc, collection, query, where, addDoc, deleteDoc, arrayUnion, arrayRemove, writeBatch } from 'firebase/firestore'
import { db } from '../firebase'

type Client = {
  name: string
  description?: string
  slackChannel?: string
  contactName?: string
  contactPhone?: string
  contactEmail?: string
  logoUrl?: string
  contactPhotoUrl?: string
}

type Project = {
  id: string
  name: string
  clientId: string
  description?: string
  contactName?: string
  contactPhone?: string
  contactEmail?: string
  consultantIds?: string[]
}

type Consultant = {
  id: string
  name: string
  photoUrl?: string
}

const inputClass = "border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-[#222] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all w-full"
const labelClass = "text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider"

export function ClientDetailPage() {
  const { id } = useParams<{ id: string }>()
  const [client, setClient] = useState<Client | null>(null)
  const [projects, setProjects] = useState<Project[]>([])
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [saved, setSaved] = useState(false)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [slackChannel, setSlackChannel] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [contactPhotoUrl, setContactPhotoUrl] = useState('')

  const [showProjectForm, setShowProjectForm] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [addingProject, setAddingProject] = useState(false)

  const [draggingConsultant, setDraggingConsultant] = useState<{ id: string; fromProjectId: string } | null>(null)
  const [dragOverProjectId, setDragOverProjectId] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return

    const unsubClient = onSnapshot(doc(db, 'clients', id), (snap) => {
      if (!snap.exists()) return
      const data = snap.data() as Client
      setClient(data)
      setName(data.name ?? '')
      setDescription(data.description ?? '')
      setSlackChannel(data.slackChannel ?? '')
      setContactName(data.contactName ?? '')
      setContactPhone(data.contactPhone ?? '')
      setContactEmail(data.contactEmail ?? '')
      setLogoUrl(data.logoUrl ?? '')
      setContactPhotoUrl(data.contactPhotoUrl ?? '')
    })

    const unsubProjects = onSnapshot(
      query(collection(db, 'projects'), where('clientId', '==', id)),
      (snap) => setProjects(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Project)))
    )

    const unsubConsultants = onSnapshot(collection(db, 'consultants'), (snap) => {
      setConsultants(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Consultant)).sort((a, b) => a.name.localeCompare(b.name)))
    })

    return () => { unsubClient(); unsubProjects(); unsubConsultants() }
  }, [id])

  async function handleSaveClient() {
    if (!id) return
    await updateDoc(doc(db, 'clients', id), { name, description: description || null, slackChannel: slackChannel || null, contactName: contactName || null, contactPhone: contactPhone || null, contactEmail: contactEmail || null, logoUrl: logoUrl || null, contactPhotoUrl: contactPhotoUrl || null })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function handleAddProject(e: React.FormEvent) {
    e.preventDefault()
    if (!id) return
    setAddingProject(true)
    await addDoc(collection(db, 'projects'), { name: newProjectName, clientId: id, consultantIds: [] })
    setNewProjectName('')
    setShowProjectForm(false)
    setAddingProject(false)
  }

  async function handleDeleteProject(projectId: string) {
    await deleteDoc(doc(db, 'projects', projectId))
  }

  async function handleDropOnProject(targetProjectId: string) {
    if (!draggingConsultant || draggingConsultant.fromProjectId === targetProjectId) return
    const batch = writeBatch(db)
    // Remove from all projects to enforce single-project invariant
    for (const p of projects) {
      if (p.consultantIds?.includes(draggingConsultant.id)) {
        batch.update(doc(db, 'projects', p.id), { consultantIds: arrayRemove(draggingConsultant.id) })
      }
    }
    batch.update(doc(db, 'projects', targetProjectId), { consultantIds: arrayUnion(draggingConsultant.id) })
    await batch.commit()
  }

  if (!client) return null

  return (
    <div className="max-w-2xl">
      <div className="mb-8">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{client.name}</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">Kundedetaljer</p>
      </div>

      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6 flex flex-col gap-5 mb-6 transition-colors">

        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Kundenavn</label>
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Beskrivelse</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className={`${inputClass} resize-none`} placeholder="Om kunden..." />
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Slack-kanal</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-gray-600 text-sm">#</span>
            <input type="text" value={slackChannel} onChange={(e) => setSlackChannel(e.target.value)} className={`${inputClass} pl-6`} placeholder="kanal-navn" />
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label className={labelClass}>Logo URL</label>
          <input type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} className={inputClass} placeholder="https://logo.clearbit.com/firma.com" />
        </div>

        <div className="h-px bg-gray-100 dark:bg-gray-800" />

        <p className={labelClass}>Kontaktperson</p>
        <div className="grid grid-cols-1 gap-4 -mt-3">
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Navn</label>
            <input type="text" value={contactName} onChange={(e) => setContactName(e.target.value)} className={inputClass} placeholder="Fornavn Etternavn" />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelClass}>Bilde URL</label>
            <input type="url" value={contactPhotoUrl} onChange={(e) => setContactPhotoUrl(e.target.value)} className={inputClass} placeholder="https://..." />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>Telefon</label>
              <input type="tel" value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} className={inputClass} placeholder="+47 000 00 000" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className={labelClass}>E-post</label>
              <input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} className={inputClass} placeholder="navn@firma.no" />
            </div>
          </div>
        </div>

        <div className="h-px bg-gray-100 dark:bg-gray-800" />

        <div className="flex items-center gap-3">
          <button onClick={handleSaveClient} className="bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium px-5 py-2.5 rounded-xl transition-colors">
            Lagre endringer
          </button>
          {saved && <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Lagret!</span>}
        </div>
      </div>

      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 uppercase tracking-wider">Prosjekter</h2>
        <button onClick={() => setShowProjectForm(true)} className="text-xs font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white border border-gray-200 dark:border-gray-700 px-3 py-1.5 rounded-lg transition-colors">
          + Nytt prosjekt
        </button>
      </div>

      {showProjectForm && (
        <form onSubmit={handleAddProject} className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-gray-700 p-4 mb-3 flex gap-2">
          <input autoFocus type="text" required placeholder="Prosjektnavn" value={newProjectName} onChange={(e) => setNewProjectName(e.target.value)} className={`${inputClass} flex-1`} />
          <button type="button" onClick={() => setShowProjectForm(false)} className="px-3 py-2 text-sm text-gray-500 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">Avbryt</button>
          <button type="submit" disabled={addingProject} className="px-4 py-2 text-sm font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-40 rounded-xl transition-colors">Opprett</button>
        </form>
      )}

      {projects.length === 0 && !showProjectForm ? (
        <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-600">
          Ingen prosjekter ennå
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {projects.map((p) => (
            <ProjectCard
              key={p.id}
              project={p}
              allConsultants={consultants}
              onDelete={() => handleDeleteProject(p.id)}
              isDropTarget={dragOverProjectId === p.id && draggingConsultant?.fromProjectId !== p.id}
              onConsultantDragStart={(consultantId) => setDraggingConsultant({ id: consultantId, fromProjectId: p.id })}
              onDragOver={() => setDragOverProjectId(p.id)}
              onDragLeave={() => setDragOverProjectId(null)}
              onDrop={async () => { await handleDropOnProject(p.id); setDraggingConsultant(null); setDragOverProjectId(null) }}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function ProjectCard({ project, allConsultants, onDelete, isDropTarget, onConsultantDragStart, onDragOver, onDragLeave, onDrop }: {
  project: Project
  allConsultants: Consultant[]
  onDelete: () => void
  isDropTarget?: boolean
  onConsultantDragStart?: (consultantId: string) => void
  onDragOver?: () => void
  onDragLeave?: () => void
  onDrop?: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(project.name)
  const [description, setDescription] = useState(project.description ?? '')
  const [contactName, setContactName] = useState(project.contactName ?? '')
  const [contactPhone, setContactPhone] = useState(project.contactPhone ?? '')
  const [contactEmail, setContactEmail] = useState(project.contactEmail ?? '')
  const [saving, setSaving] = useState(false)
  const [showConsultants, setShowConsultants] = useState(false)
  const [search, setSearch] = useState('')

  const assigned = allConsultants.filter((c) => project.consultantIds?.includes(c.id))
  const unassigned = allConsultants.filter((c) => !project.consultantIds?.includes(c.id))
  const filteredUnassigned = unassigned.filter((c) => c.name.toLowerCase().includes(search.toLowerCase()))

  async function handleSave() {
    setSaving(true)
    await updateDoc(doc(db, 'projects', project.id), { name, description: description || null, contactName: contactName || null, contactPhone: contactPhone || null, contactEmail: contactEmail || null })
    setSaving(false)
    setEditing(false)
  }

  async function handleAddConsultant(consultantId: string) {
    await updateDoc(doc(db, 'projects', project.id), { consultantIds: arrayUnion(consultantId) })
  }

  async function handleRemoveConsultant(consultantId: string) {
    await updateDoc(doc(db, 'projects', project.id), { consultantIds: arrayRemove(consultantId) })
  }

  return (
    <div
      className={`bg-white dark:bg-[#1a1a1a] rounded-2xl border shadow-sm overflow-hidden transition-colors ${isDropTarget ? 'border-blue-400 dark:border-blue-500 ring-2 ring-blue-300 dark:ring-blue-600' : 'border-gray-100 dark:border-gray-800'}`}
      onDragOver={(e) => { e.preventDefault(); onDragOver?.() }}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop?.() }}
    >
      <div className="px-5 py-4 flex items-center justify-between border-b border-gray-100 dark:border-gray-800">
        {editing ? (
          <input value={name} onChange={(e) => setName(e.target.value)} className="text-sm font-semibold text-gray-900 dark:text-white bg-transparent border-b border-gray-300 dark:border-gray-600 focus:outline-none flex-1 mr-4" />
        ) : (
          <span className="text-sm font-semibold text-gray-900 dark:text-white">{project.name}</span>
        )}
        <div className="flex items-center gap-3">
          {editing ? (
            <>
              <button onClick={() => setEditing(false)} className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Avbryt</button>
              <button onClick={handleSave} disabled={saving} className="text-xs font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900 px-3 py-1.5 rounded-lg disabled:opacity-40 transition-colors">
                {saving ? 'Lagrer…' : 'Lagre'}
              </button>
            </>
          ) : (
            <>
              <button onClick={() => setEditing(true)} className="text-xs text-gray-400 dark:text-gray-600 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">Rediger</button>
              <button onClick={onDelete} className="text-xs text-gray-400 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors">Slett</button>
            </>
          )}
        </div>
      </div>

      {editing ? (
        <div className="px-5 py-4 flex flex-col gap-3">
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} placeholder="Beskrivelse av prosjektet…" className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-[#222] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white w-full resize-none" />
          <div className="grid grid-cols-3 gap-3">
            <input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Kontaktperson" className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-[#222] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white" />
            <input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+47 000 00 000" className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-[#222] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white" />
            <input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="epost@firma.no" className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-[#222] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white" />
          </div>
        </div>
      ) : (
        <div className="px-5 py-4 flex flex-col gap-3">
          {project.description && <p className="text-sm text-gray-600 dark:text-gray-400">{project.description}</p>}
          {project.contactName && (
            <div className="flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
              <span className="font-medium text-gray-700 dark:text-gray-300">{project.contactName}</span>
              {project.contactPhone && <span>{project.contactPhone}</span>}
              {project.contactEmail && <a href={`mailto:${project.contactEmail}`} className="hover:underline">{project.contactEmail}</a>}
            </div>
          )}

          {/* Consultants */}
          <div className="border border-gray-100 dark:border-gray-800 rounded-xl overflow-hidden">
            {/* Assigned */}
            {assigned.map((c) => (
              <div
                key={c.id}
                draggable
                onDragStart={() => onConsultantDragStart?.(c.id)}
                className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100 dark:border-gray-800 last:border-b-0 bg-gray-50/60 dark:bg-gray-800/30 cursor-grab active:cursor-grabbing"
              >
                <div className="flex items-center gap-2.5">
                  {c.photoUrl ? (
                    <img src={c.photoUrl} alt={c.name} className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 text-[10px] font-semibold flex-shrink-0">{c.name?.charAt(0)}</div>
                  )}
                  <span className="text-sm text-gray-800 dark:text-gray-200 font-medium">{c.name}</span>
                </div>
                <button
                  onClick={() => handleRemoveConsultant(c.id)}
                  className="text-xs text-gray-400 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors px-1"
                  title="Fjern fra prosjekt"
                >
                  Fjern
                </button>
              </div>
            ))}

            {/* Divider + toggle */}
            {unassigned.length > 0 && (
              <>
                <button
                  onClick={() => { setShowConsultants((v) => !v); setSearch('') }}
                  className="w-full flex items-center justify-between px-3 py-2 text-xs text-gray-400 dark:text-gray-600 hover:text-gray-600 dark:hover:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors border-t border-dashed border-gray-200 dark:border-gray-700"
                >
                  <span>{showConsultants ? 'Skjul' : `+ Legg til konsulenter (${unassigned.length} tilgjengelige)`}</span>
                  <span className="text-gray-300 dark:text-gray-700">{showConsultants ? '▲' : '▼'}</span>
                </button>
                {showConsultants && (
                  <div className="border-t border-gray-100 dark:border-gray-800 px-3 py-2">
                    <input
                      autoFocus
                      type="text"
                      placeholder="Søk etter konsulent…"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-[#222] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white placeholder-gray-300 dark:placeholder-gray-600 transition-all"
                    />
                  </div>
                )}
                {showConsultants && filteredUnassigned.length === 0 && (
                  <div className="px-3 py-3 text-xs text-gray-400 dark:text-gray-600 text-center border-t border-gray-100 dark:border-gray-800">
                    {search ? 'Ingen treff' : 'Alle er lagt til'}
                  </div>
                )}
                {showConsultants && filteredUnassigned.map((c) => (
                  <div key={c.id} className="flex items-center justify-between px-3 py-2.5 border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-800/40 transition-colors">
                    <div className="flex items-center gap-2.5">
                      {c.photoUrl ? (
                        <img src={c.photoUrl} alt={c.name} className="w-6 h-6 rounded-full object-cover flex-shrink-0 opacity-60" />
                      ) : (
                        <div className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-600 text-[10px] font-semibold flex-shrink-0">{c.name?.charAt(0)}</div>
                      )}
                      <span className="text-sm text-gray-500 dark:text-gray-500">{c.name}</span>
                    </div>
                    <button
                      onClick={() => { handleAddConsultant(c.id); setSearch('') }}
                      className="text-xs font-medium text-gray-900 dark:text-white bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 px-2.5 py-1 rounded-lg transition-colors"
                    >
                      + Legg til
                    </button>
                  </div>
                ))}
              </>
            )}

            {assigned.length === 0 && unassigned.length === 0 && (
              <div className="px-3 py-4 text-xs text-gray-400 dark:text-gray-600 text-center">Ingen konsulenter</div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
