import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { doc, getDoc, updateDoc, collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'

type Consultant = {
  name: string
  photoUrl?: string
  isInternal?: boolean
  contractStart?: string
  contractEnd?: string
  warningDays?: number
  notifyAll?: boolean
  notifyList?: string[]
}

type Admin = { id: string; name: string; email: string }

export function ConsultantDetailPage() {
  const { id } = useParams<{ id: string }>()

  const [consultant, setConsultant] = useState<Consultant | null>(null)
  const [admins, setAdmins] = useState<Admin[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

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

  return (
    <div className="max-w-xl">
      <div className="flex items-center gap-4 mb-8">
        {consultant.photoUrl ? (
          <img src={consultant.photoUrl} alt={consultant.name} className="w-14 h-14 rounded-full object-cover ring-2 ring-white dark:ring-gray-800 shadow-sm" />
        ) : (
          <div className="w-14 h-14 rounded-full bg-gray-200 dark:bg-gray-700 flex items-center justify-center text-gray-500 dark:text-gray-400 text-lg font-semibold">
            {consultant.name?.charAt(0)}
          </div>
        )}
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">{consultant.name}</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500">Rediger kontraktsinformasjon</p>
        </div>
      </div>

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
  )
}
