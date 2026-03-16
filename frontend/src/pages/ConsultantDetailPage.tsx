import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc, updateDoc, collection, onSnapshot } from 'firebase/firestore'
import { getIdToken } from 'firebase/auth'
import { db, auth } from '../firebase'

type Consultant = {
  name: string
  photoUrl?: string
  email?: string
  telephone?: string
  isInternal?: boolean
  contractStart?: string
  contractEnd?: string
  warningDays?: number
  notifyAll?: boolean
  notifyList?: string[]
}

type Admin = { id: string; name: string; email: string }

type CVWorkEntry = { id: string; employer?: string; description?: string; yearFrom?: number; monthFrom?: number; yearTo?: number; monthTo?: number }
type CVProjectEntry = { id: string; customer?: string; roles: string[]; description?: string; yearFrom?: number; monthFrom?: number; yearTo?: number; monthTo?: number }
type CVEducationEntry = { id: string; school?: string; degree?: string; yearFrom?: number; yearTo?: number }
type CVTechGroup = { label?: string; tags: string[] }
type CVKeyQual = { label?: string; description?: string }
type CVData = {
  workExperience: CVWorkEntry[]
  projectExperience: CVProjectEntry[]
  education: CVEducationEntry[]
  technologies: CVTechGroup[]
  keyQualifications: CVKeyQual[]
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'mai', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'des']

function fmtPeriod(yFrom?: number, mFrom?: number, yTo?: number, mTo?: number): string {
  const from = yFrom ? (mFrom ? `${MONTHS[mFrom - 1]} ${yFrom}` : `${yFrom}`) : ''
  const to = yTo ? (mTo ? `${MONTHS[mTo - 1]} ${yTo}` : `${yTo}`) : 'nå'
  if (!from) return ''
  return `${from} – ${to}`
}

function PeriodBadge({ yFrom, mFrom, yTo, mTo }: { yFrom?: number; mFrom?: number; yTo?: number; mTo?: number }) {
  const label = fmtPeriod(yFrom, mFrom, yTo, mTo)
  if (!label) return null
  return <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums">{label}</span>
}

export function ConsultantDetailPage() {
  const { id } = useParams<{ id: string }>()

  const [consultant, setConsultant] = useState<Consultant | null>(null)
  const [admins, setAdmins] = useState<Admin[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [cv, setCv] = useState<CVData | null>(null)
  const [cvLoading, setCvLoading] = useState(true)

  const [isInternal, setIsInternal] = useState(false)
  const [contractStart, setContractStart] = useState('')
  const [contractEnd, setContractEnd] = useState('')
  const [warningDays, setWarningDays] = useState<number | ''>('')
  const [notifyAll, setNotifyAll] = useState(true)
  const [notifyList, setNotifyList] = useState<string[]>([])

  useEffect(() => {
    if (!id) return
    getDoc(doc(db, 'consultants', id)).then((snap) => {
      if (!snap.exists()) return
      const data = snap.data() as Consultant
      setConsultant(data)
      setIsInternal(data.isInternal ?? false)
      setContractStart(data.contractStart ?? '')
      setContractEnd(data.contractEnd ?? '')
      setWarningDays(data.warningDays ?? '')
      setNotifyAll(data.notifyAll ?? true)
      setNotifyList(data.notifyList ?? [])
    })
    const u1 = onSnapshot(collection(db, 'admins'), (s) => setAdmins(s.docs.map((d) => ({ id: d.id, ...d.data() } as Admin))))

    // Fetch CV from backend
    async function loadCV() {
      try {
        const token = await getIdToken(auth.currentUser!)
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/cv/${id}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) setCv(await res.json())
      } catch { /* silent */ }
      finally { setCvLoading(false) }
    }
    loadCV()

    return () => { u1() }
  }, [id])

  async function handleSave() {
    if (!id) return
    setSaving(true)
    await updateDoc(doc(db, 'consultants', id), {
      isInternal,
      contractStart: contractStart || null,
      contractEnd: contractEnd || null,
      warningDays: warningDays !== '' ? warningDays : null,
      notifyAll,
      notifyList: notifyAll ? [] : notifyList,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function toggleNotifyAdmin(uid: string) {
    setNotifyList((prev) => prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid])
  }

  if (!consultant) return null

  const inputClass = "border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-[#222] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all w-full"
  const labelClass = "text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider"

  const hasCv = cv && (
    cv.projectExperience.length > 0 ||
    cv.workExperience.length > 0 ||
    cv.education.length > 0 ||
    cv.technologies.length > 0 ||
    cv.keyQualifications.length > 0
  )

  return (
    <div className="flex flex-col gap-6">

      {/* Profile header */}
      <div className="flex items-center gap-5">
        {consultant.photoUrl ? (
          <img src={consultant.photoUrl} alt={consultant.name} className="w-24 h-24 rounded-2xl object-cover ring-2 ring-white dark:ring-gray-800 shadow-md flex-shrink-0" />
        ) : (
          <div className="w-24 h-24 rounded-2xl bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 text-2xl font-semibold flex-shrink-0">
            {consultant.name?.charAt(0)}
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">{consultant.name}</h1>
          <div className="flex flex-col gap-1.5 mt-0.5">
            {consultant.email && (
              <a href={`mailto:${consultant.email}`} className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <rect x="2" y="4" width="20" height="16" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                </svg>
                <span>{consultant.email}</span>
              </a>
            )}
            {consultant.telephone && (
              <a href={`tel:${consultant.telephone}`} className="flex items-center gap-2 text-sm text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 transition-colors">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
                  <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.69 12a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.62 1h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 8.6a16 16 0 0 0 5.5 5.5l.97-.97a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>
                </svg>
                <span>{consultant.telephone}</span>
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Two-column layout: admin form left, CV right */}
      <div className="flex gap-6 items-start flex-wrap lg:flex-nowrap">

        {/* ── Admin settings (left) ── */}
        <div className="w-full lg:w-96 flex-shrink-0 flex flex-col gap-4">

          {/* Internal toggle */}
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm px-5 py-4 flex items-center justify-between transition-colors">
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Intern ansatt</p>
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Telles ikke med i konsulentstatistikk eller uten-oppdrag-varsler</p>
            </div>
            <button
              type="button"
              onClick={() => setIsInternal(!isInternal)}
              className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${isInternal ? 'bg-gray-900 dark:bg-white' : 'bg-gray-200 dark:bg-gray-700'}`}
            >
              <span className={`absolute top-1 left-1 w-4 h-4 rounded-full bg-white dark:bg-gray-900 shadow transition-transform ${isInternal ? 'translate-x-5' : 'translate-x-0'}`} />
            </button>
          </div>

          {!isInternal && (
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6 flex flex-col gap-5 transition-colors">

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Kontraktstart</label>
                  <input type="date" value={contractStart} onChange={(e) => setContractStart(e.target.value)} className={inputClass} />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className={labelClass}>Kontraktslutt</label>
                  <input type="date" value={contractEnd} onChange={(e) => setContractEnd(e.target.value)} className={inputClass} />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className={labelClass}>Varsle X dager før kontraktslutt</label>
                <div className="flex gap-2 flex-wrap">
                  {[7, 14, 30, 60, 90].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setWarningDays(warningDays === d ? '' : d)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
                        warningDays === d
                          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white'
                          : 'bg-white dark:bg-transparent text-gray-500 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}
                    >
                      {d} dager
                    </button>
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={365}
                    placeholder="Egendefinert antall dager"
                    value={warningDays}
                    onChange={(e) => setWarningDays(e.target.value === '' ? '' : Number(e.target.value))}
                    className={inputClass}
                  />
                  {warningDays !== '' && (
                    <button type="button" onClick={() => setWarningDays('')} className="text-xs text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 whitespace-nowrap transition-colors">
                      Nullstill
                    </button>
                  )}
                </div>
                {warningDays !== '' && contractEnd && (
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    Varsel sendes {new Date(new Date(contractEnd).getTime() - Number(warningDays) * 86400000).toLocaleDateString('nb-NO', { day: 'numeric', month: 'long', year: 'numeric' })}
                  </p>
                )}
              </div>

              <div className="h-px bg-gray-100 dark:bg-gray-800" />

              <div className="flex flex-col gap-2.5">
                <label className={labelClass}>Varsle</label>
                <div className="flex gap-2">
                  {[true, false].map((val) => (
                    <button key={String(val)} type="button" onClick={() => setNotifyAll(val)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium border transition-all ${
                        notifyAll === val
                          ? 'bg-gray-900 dark:bg-white text-white dark:text-gray-900 border-gray-900 dark:border-white'
                          : 'bg-white dark:bg-transparent text-gray-500 dark:text-gray-500 border-gray-200 dark:border-gray-700 hover:border-gray-400 dark:hover:border-gray-500'
                      }`}>
                      {val ? 'Varsle alle' : 'Velg spesifikke'}
                    </button>
                  ))}
                </div>
                {!notifyAll && (
                  <div className="flex flex-col gap-2 mt-1 pl-1">
                    {admins.map((a) => (
                      <label key={a.id} className="flex items-center gap-2.5 text-sm text-gray-700 dark:text-gray-300 cursor-pointer">
                        <input type="checkbox" checked={notifyList.includes(a.id)} onChange={() => toggleNotifyAdmin(a.id)} className="rounded accent-gray-900 dark:accent-white" />
                        <span>{a.name}</span>
                        <span className="text-gray-400 dark:text-gray-600 text-xs">{a.email}</span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="h-px bg-gray-100 dark:bg-gray-800" />

              <div className="flex items-center gap-3">
                <button onClick={handleSave} disabled={saving}
                  className="bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-40 text-white dark:text-gray-900 text-sm font-medium px-5 py-2.5 rounded-xl transition-colors">
                  {saving ? 'Lagrer…' : 'Lagre endringer'}
                </button>
                {saved && <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Lagret!</span>}
              </div>
            </div>
          )}

          {isInternal && (
            <div className="flex items-center gap-3">
              <button onClick={handleSave} disabled={saving}
                className="bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-40 text-white dark:text-gray-900 text-sm font-medium px-5 py-2.5 rounded-xl transition-colors">
                {saving ? 'Lagrer…' : 'Lagre endringer'}
              </button>
              {saved && <span className="text-sm text-emerald-600 dark:text-emerald-400 font-medium">Lagret!</span>}
            </div>
          )}
        </div>

        {/* ── CV section (right) ── */}
        <div className="flex-1 min-w-0 flex flex-col gap-5">
          {cvLoading && (
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-8 flex items-center justify-center">
              <svg className="animate-spin h-5 w-5 text-gray-400" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            </div>
          )}

          {!cvLoading && !hasCv && (
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-8 text-center text-sm text-gray-400 dark:text-gray-600">
              Ingen CV-data funnet i Flowcase
            </div>
          )}

          {/* Key qualifications / skills */}
          {cv && cv.keyQualifications.length > 0 && (
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 flex flex-col gap-4 transition-colors">
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider">Nøkkelkvalifikasjoner</h2>
              <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
                {cv.keyQualifications.map((kq, i) => (
                  <div key={kq.label ?? i} className="py-3 first:pt-0 last:pb-0 flex flex-col gap-1">
                    {kq.label && <p className="text-sm font-semibold text-gray-800 dark:text-gray-200">{kq.label}</p>}
                    {kq.description && <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed whitespace-pre-line">{kq.description}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Technologies */}
          {cv && cv.technologies.length > 0 && (
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 flex flex-col gap-4 transition-colors">
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider">Teknologi</h2>
              <div className="flex flex-col gap-3">
                {cv.technologies.map((group) => (
                  <div key={group.label ?? Math.random()}>
                    {group.label && <p className="text-xs font-medium text-gray-500 dark:text-gray-500 mb-1.5">{group.label}</p>}
                    <div className="flex flex-wrap gap-1.5">
                      {group.tags.map((tag) => (
                        <span key={tag} className="text-xs bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 px-2.5 py-1 rounded-full border border-indigo-100 dark:border-indigo-900/50">{tag}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Project experience */}
          {cv && cv.projectExperience.length > 0 && (
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 flex flex-col gap-4 transition-colors">
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider">Prosjekterfaring</h2>
              <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
                {cv.projectExperience.map((p) => (
                  <div key={p.id} className="py-4 first:pt-0 last:pb-0 flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex flex-col gap-0.5">
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{p.customer ?? '–'}</p>
                        {p.roles.length > 0 && (
                          <p className="text-xs text-indigo-600 dark:text-indigo-400 font-medium">{p.roles.join(', ')}</p>
                        )}
                      </div>
                      <PeriodBadge yFrom={p.yearFrom} mFrom={p.monthFrom} yTo={p.yearTo} mTo={p.monthTo} />
                    </div>
                    {p.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed whitespace-pre-line">{p.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Work experience */}
          {cv && cv.workExperience.length > 0 && (
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 flex flex-col gap-4 transition-colors">
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider">Arbeidserfaring</h2>
              <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
                {cv.workExperience.map((w) => (
                  <div key={w.id} className="py-4 first:pt-0 last:pb-0 flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-semibold text-gray-900 dark:text-white">{w.employer ?? '–'}</p>
                      <PeriodBadge yFrom={w.yearFrom} mFrom={w.monthFrom} yTo={w.yearTo} mTo={w.monthTo} />
                    </div>
                    {w.description && (
                      <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed whitespace-pre-line">{w.description}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Education */}
          {cv && cv.education.length > 0 && (
            <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-5 flex flex-col gap-4 transition-colors">
              <h2 className="text-xs font-semibold text-gray-400 dark:text-gray-600 uppercase tracking-wider">Utdanning</h2>
              <div className="flex flex-col divide-y divide-gray-100 dark:divide-gray-800">
                {cv.education.map((e) => (
                  <div key={e.id} className="py-4 first:pt-0 last:pb-0 flex flex-col gap-0.5">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-900 dark:text-white">{e.school ?? '–'}</p>
                        {e.degree && <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{e.degree}</p>}
                      </div>
                      {(e.yearFrom || e.yearTo) && (
                        <span className="text-xs text-gray-400 dark:text-gray-500 tabular-nums flex-shrink-0">
                          {e.yearFrom ?? ''}{e.yearFrom && e.yearTo ? ' – ' : ''}{e.yearTo ?? ''}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
