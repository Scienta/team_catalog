import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc, updateDoc, collection, onSnapshot } from 'firebase/firestore'
import { getIdToken } from 'firebase/auth'
import { db, auth } from '../firebase'

type AbsencePeriod = { fra: string; til: string | null }

type Consultant = {
  name: string
  photoUrl?: string
  email?: string
  telephone?: string
  isInternal?: boolean
  sykemeldtPerioder?: AbsencePeriod[]
  permittertPerioder?: AbsencePeriod[]
  contractStart?: string
  contractEnd?: string
  warningDays?: number
  notifyAll?: boolean
  notifyList?: string[]
  lastSyncedAt?: { seconds: number; nanoseconds: number }
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

function isActiveNow(periods: AbsencePeriod[]): boolean {
  const today = new Date().toISOString().split('T')[0]
  return periods.some(p => p.fra <= today && (p.til === null || p.til >= today))
}

function fmtShortDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('nb-NO', { day: 'numeric', month: 'short', year: 'numeric' })
}

function absenceDurationLabel(p: AbsencePeriod): string {
  const todayStr = new Date().toISOString().split('T')[0]
  const toStr = p.til ?? todayStr
  // Use local-midnight parsing to avoid UTC offset issues
  const from = new Date(p.fra + 'T00:00:00')
  const to = new Date(toStr + 'T00:00:00')
  // Inclusive days for completed periods; elapsed days for ongoing (0 = started today)
  const days = p.til
    ? Math.round((to.getTime() - from.getTime()) / 86400000) + 1
    : Math.round((to.getTime() - from.getTime()) / 86400000)
  if (days === 0) return 'i dag'
  if (days < 7) return `${days}d`
  const weeks = Math.floor(days / 7)
  if (weeks < 9) return `${weeks}u`
  return `${Math.round(days / 30)} mnd`
}

function fmtRelative(date: Date): string {
  const diff = Date.now() - date.getTime()
  const h = Math.floor(diff / 3600000)
  const d = Math.floor(diff / 86400000)
  if (d > 0) return `${d} dag${d !== 1 ? 'er' : ''} siden`
  if (h > 0) return `${h} time${h !== 1 ? 'r' : ''} siden`
  return 'akkurat nå'
}

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

function AddAbsencePeriodForm({ onAdd, color }: { onAdd: (fra: string, til: string | null) => void; color: 'amber' | 'blue' }) {
  const today = new Date().toISOString().split('T')[0]
  const [open, setOpen] = useState(false)
  const [fra, setFra] = useState(today)
  const [til, setTil] = useState('')

  const inputCls = `border rounded-xl px-3 py-2 text-sm text-gray-800 dark:text-gray-200 bg-white/70 dark:bg-[#222] focus:outline-none focus:ring-2 w-full ${
    color === 'amber' ? 'border-amber-200 dark:border-amber-800 focus:ring-amber-400' : 'border-blue-200 dark:border-blue-800 focus:ring-blue-400'
  }`
  const btnCls = `text-xs font-medium px-3 py-1.5 rounded-lg transition-colors ${
    color === 'amber' ? 'bg-amber-500 hover:bg-amber-600 text-white' : 'bg-blue-500 hover:bg-blue-600 text-white'
  }`

  if (!open) return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className={`text-xs font-medium flex items-center gap-1.5 transition-colors ${color === 'amber' ? 'text-amber-700 dark:text-amber-400 hover:text-amber-900' : 'text-blue-700 dark:text-blue-400 hover:text-blue-900'}`}
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
      Legg til periode
    </button>
  )

  return (
    <div className="flex flex-col gap-2 pt-1">
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-medium uppercase tracking-wider ${color === 'amber' ? 'text-amber-700 dark:text-amber-400' : 'text-blue-700 dark:text-blue-400'}`}>Fra</label>
          <input type="date" value={fra} onChange={(e) => setFra(e.target.value)} className={inputCls} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={`text-xs font-medium uppercase tracking-wider ${color === 'amber' ? 'text-amber-700 dark:text-amber-400' : 'text-blue-700 dark:text-blue-400'}`}>Til <span className="normal-case font-normal opacity-60">(valgfritt)</span></label>
          <input type="date" value={til} onChange={(e) => setTil(e.target.value)} className={inputCls} />
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button type="button" onClick={() => { onAdd(fra, til || null); setOpen(false); setFra(today); setTil('') }} disabled={!fra} className={btnCls}>
          Legg til
        </button>
        <button type="button" onClick={() => { setOpen(false); setFra(today); setTil('') }} className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors">
          Avbryt
        </button>
      </div>
    </div>
  )
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
  const [sykemeldtPerioder, setSykemeldtPerioder] = useState<AbsencePeriod[]>([])
  const [permittertPerioder, setPermittertPerioder] = useState<AbsencePeriod[]>([])
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

      const today = new Date().toISOString().split('T')[0]
      const rawSyke = (data as any).sykemeldtPerioder as AbsencePeriod[] | undefined
      const rawPerm = (data as any).permittertPerioder as AbsencePeriod[] | undefined
      setSykemeldtPerioder(rawSyke ?? ((data as any).sykemeldt ? [{ fra: (data as any).sykemeldtFra ?? today, til: (data as any).sykemeldtTil ?? null }] : []))
      setPermittertPerioder(rawPerm ?? ((data as any).permittert ? [{ fra: (data as any).permittertFra ?? today, til: (data as any).permittertTil ?? null }] : []))

      setContractStart(data.contractStart ?? '2026-01-01')
      setContractEnd(data.contractEnd ?? '2026-12-31')
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
      } catch (e) { console.error('Failed to load CV:', e) }
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

  async function addAbsencePeriod(type: 'sykemeldt' | 'permittert', fra: string, til: string | null) {
    if (!id || !fra) return
    const key = type === 'sykemeldt' ? 'sykemeldtPerioder' : 'permittertPerioder'
    const current = type === 'sykemeldt' ? sykemeldtPerioder : permittertPerioder
    const updated = [...current, { fra, til }].sort((a, b) => b.fra.localeCompare(a.fra))
    await updateDoc(doc(db, 'consultants', id), { [key]: updated })
    if (type === 'sykemeldt') setSykemeldtPerioder(updated)
    else setPermittertPerioder(updated)
  }

  async function removeAbsencePeriod(type: 'sykemeldt' | 'permittert', index: number) {
    if (!id) return
    const key = type === 'sykemeldt' ? 'sykemeldtPerioder' : 'permittertPerioder'
    const current = type === 'sykemeldt' ? sykemeldtPerioder : permittertPerioder
    const updated = current.filter((_, i) => i !== index)
    await updateDoc(doc(db, 'consultants', id), { [key]: updated })
    if (type === 'sykemeldt') setSykemeldtPerioder(updated)
    else setPermittertPerioder(updated)
  }

  async function endAbsencePeriod(type: 'sykemeldt' | 'permittert', index: number) {
    if (!id) return
    const today = new Date().toISOString().split('T')[0]
    const key = type === 'sykemeldt' ? 'sykemeldtPerioder' : 'permittertPerioder'
    const current = type === 'sykemeldt' ? sykemeldtPerioder : permittertPerioder
    const updated = current.map((p, i) => i === index ? { ...p, til: today } : p)
    await updateDoc(doc(db, 'consultants', id), { [key]: updated })
    if (type === 'sykemeldt') setSykemeldtPerioder(updated)
    else setPermittertPerioder(updated)
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
            {consultant.lastSyncedAt && (
              <span className="text-xs text-gray-300 dark:text-gray-700">
                Synkronisert {fmtRelative(new Date(consultant.lastSyncedAt.seconds * 1000))}
              </span>
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

          {/* Sykmeldingsperioder */}
          {(() => {
            const isActive = isActiveNow(sykemeldtPerioder)
            return (
              <div className={`rounded-2xl border shadow-sm px-5 py-4 flex flex-col gap-3 transition-colors ${isActive ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800' : 'bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-gray-800'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Sykmeldingsperioder</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {isActive ? 'Aktiv nå' : sykemeldtPerioder.length > 0 ? `${sykemeldtPerioder.length} historiske periode${sykemeldtPerioder.length !== 1 ? 'r' : ''}` : 'Ingen registrerte perioder'}
                    </p>
                  </div>
                  {isActive && (
                    <span className="text-xs font-semibold bg-amber-200 dark:bg-amber-900/60 text-amber-800 dark:text-amber-300 px-2.5 py-1 rounded-full flex-shrink-0">Sykemeldt</span>
                  )}
                </div>

                {sykemeldtPerioder.length > 0 && (
                  <div className="flex flex-col gap-2 border-t border-amber-100 dark:border-amber-900/40 pt-3">
                    {sykemeldtPerioder.map((p, i) => {
                      const ongoing = p.til === null
                      return (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-gray-800 dark:text-gray-200">{fmtShortDate(p.fra)}</span>
                            <span className="text-gray-400 dark:text-gray-600 mx-1">–</span>
                            <span className={ongoing ? 'text-amber-600 dark:text-amber-400 font-medium' : 'text-gray-800 dark:text-gray-200'}>{ongoing ? 'pågående' : fmtShortDate(p.til!)}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-600"> · {absenceDurationLabel(p)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {ongoing && (
                              <button type="button" onClick={() => endAbsencePeriod('sykemeldt', i)}
                                className="text-xs text-amber-700 dark:text-amber-400 hover:text-amber-900 font-medium transition-colors">
                                Avslutt i dag
                              </button>
                            )}
                            <button type="button" onClick={() => removeAbsencePeriod('sykemeldt', i)}
                              className="w-5 h-5 rounded flex items-center justify-center text-gray-300 dark:text-gray-700 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <AddAbsencePeriodForm onAdd={(fra, til) => addAbsencePeriod('sykemeldt', fra, til)} color="amber" />
              </div>
            )
          })()}

          {/* Permisjonsperioder */}
          {(() => {
            const isActive = isActiveNow(permittertPerioder)
            return (
              <div className={`rounded-2xl border shadow-sm px-5 py-4 flex flex-col gap-3 transition-colors ${isActive ? 'bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-[#1a1a1a] border-gray-100 dark:border-gray-800'}`}>
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-800 dark:text-gray-200">Permisjonsperioder</p>
                    <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                      {isActive ? 'Aktiv nå' : permittertPerioder.length > 0 ? `${permittertPerioder.length} historiske periode${permittertPerioder.length !== 1 ? 'r' : ''}` : 'Ingen registrerte perioder'}
                    </p>
                  </div>
                  {isActive && (
                    <span className="text-xs font-semibold bg-blue-200 dark:bg-blue-900/60 text-blue-800 dark:text-blue-300 px-2.5 py-1 rounded-full flex-shrink-0">Permittert</span>
                  )}
                </div>

                {permittertPerioder.length > 0 && (
                  <div className="flex flex-col gap-2 border-t border-blue-100 dark:border-blue-900/40 pt-3">
                    {permittertPerioder.map((p, i) => {
                      const ongoing = p.til === null
                      return (
                        <div key={i} className="flex items-center gap-2 text-sm">
                          <div className="flex-1 min-w-0">
                            <span className="font-medium text-gray-800 dark:text-gray-200">{fmtShortDate(p.fra)}</span>
                            <span className="text-gray-400 dark:text-gray-600 mx-1">–</span>
                            <span className={ongoing ? 'text-blue-600 dark:text-blue-400 font-medium' : 'text-gray-800 dark:text-gray-200'}>{ongoing ? 'pågående' : fmtShortDate(p.til!)}</span>
                            <span className="text-xs text-gray-400 dark:text-gray-600"> · {absenceDurationLabel(p)}</span>
                          </div>
                          <div className="flex items-center gap-1.5 flex-shrink-0">
                            {ongoing && (
                              <button type="button" onClick={() => endAbsencePeriod('permittert', i)}
                                className="text-xs text-blue-700 dark:text-blue-400 hover:text-blue-900 font-medium transition-colors">
                                Avslutt i dag
                              </button>
                            )}
                            <button type="button" onClick={() => removeAbsencePeriod('permittert', i)}
                              className="w-5 h-5 rounded flex items-center justify-center text-gray-300 dark:text-gray-700 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all">
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                            </button>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}

                <AddAbsencePeriodForm onAdd={(fra, til) => addAbsencePeriod('permittert', fra, til)} color="blue" />
              </div>
            )
          })()}

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
