import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { doc, getDoc, updateDoc, collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { NewClientModal } from '../components/NewClientModal'

type Consultant = {
  name: string
  photoUrl?: string
  clientId?: string
  contractStart?: string
  contractEnd?: string
  warningDate?: string
  notifyAll?: boolean
  notifyList?: string[]
}

type Client = { id: string; name: string }
type Admin = { id: string; name: string; email: string }

export function ConsultantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()

  const [consultant, setConsultant] = useState<Consultant | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [admins, setAdmins] = useState<Admin[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [showNewClientModal, setShowNewClientModal] = useState(false)

  // Editable fields
  const [clientId, setClientId] = useState('')
  const [contractStart, setContractStart] = useState('')
  const [contractEnd, setContractEnd] = useState('')
  const [warningDate, setWarningDate] = useState('')
  const [notifyAll, setNotifyAll] = useState(true)
  const [notifyList, setNotifyList] = useState<string[]>([])

  useEffect(() => {
    if (!id) return
    getDoc(doc(db, 'consultants', id)).then((snap) => {
      if (!snap.exists()) return
      const data = snap.data() as Consultant
      setConsultant(data)
      setClientId(data.clientId ?? '')
      setContractStart(data.contractStart ?? '')
      setContractEnd(data.contractEnd ?? '')
      setWarningDate(data.warningDate ?? '')
      setNotifyAll(data.notifyAll ?? true)
      setNotifyList(data.notifyList ?? [])
    })

    const unsubClients = onSnapshot(collection(db, 'clients'), (snap) => {
      setClients(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Client)))
    })
    const unsubAdmins = onSnapshot(collection(db, 'admins'), (snap) => {
      setAdmins(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Admin)))
    })
    return () => { unsubClients(); unsubAdmins() }
  }, [id])

  async function handleSave() {
    if (!id) return
    setSaving(true)
    await updateDoc(doc(db, 'consultants', id), {
      clientId: clientId || null,
      contractStart: contractStart || null,
      contractEnd: contractEnd || null,
      warningDate: warningDate || null,
      notifyAll,
      notifyList: notifyAll ? [] : notifyList,
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  function toggleNotifyAdmin(uid: string) {
    setNotifyList((prev) =>
      prev.includes(uid) ? prev.filter((x) => x !== uid) : [...prev, uid]
    )
  }

  if (!consultant) return null

  return (
    <>
    {showNewClientModal && (
      <NewClientModal
        onClose={() => setShowNewClientModal(false)}
        onCreated={(newId, newName) => {
          setClients((prev) => [...prev, { id: newId, name: newName }])
          setClientId(newId)
          setShowNewClientModal(false)
        }}
      />
    )}
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-xl mx-auto">
        <button
          onClick={() => navigate('/')}
          className="text-sm text-blue-600 hover:underline mb-6 inline-block"
        >
          ← Tilbake
        </button>

        {/* Read-only header */}
        <div className="flex items-center gap-4 mb-8">
          {consultant.photoUrl ? (
            <img
              src={consultant.photoUrl}
              alt={consultant.name}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 text-xl font-medium">
              {consultant.name?.charAt(0)}
            </div>
          )}
          <h1 className="text-2xl font-semibold text-gray-800">{consultant.name}</h1>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-6 flex flex-col gap-5">
          {/* Kunde */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Kunde</label>
            <select
              value={clientId}
              onChange={(e) => {
                if (e.target.value === '__new__') {
                  setShowNewClientModal(true)
                } else {
                  setClientId(e.target.value)
                }
              }}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">– Ingen –</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
              <option value="__new__">+ Legg til ny kunde…</option>
            </select>
          </div>

          {/* Kontraktstart */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Kontraktstart</label>
            <input
              type="date"
              value={contractStart}
              onChange={(e) => setContractStart(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Kontraktslutt */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Kontraktslutt</label>
            <input
              type="date"
              value={contractEnd}
              onChange={(e) => setContractEnd(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Varslingsdato */}
          <div className="flex flex-col gap-1">
            <label className="text-sm font-medium text-gray-700">Varslingsdato</label>
            <input
              type="date"
              value={warningDate}
              onChange={(e) => setWarningDate(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Varsle */}
          <div className="flex flex-col gap-2">
            <label className="text-sm font-medium text-gray-700">Varsle</label>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setNotifyAll(true)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  notifyAll
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Varsle alle
              </button>
              <button
                type="button"
                onClick={() => setNotifyAll(false)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  !notifyAll
                    ? 'bg-blue-600 text-white border-blue-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                }`}
              >
                Velg spesifikke
              </button>
            </div>
            {!notifyAll && (
              <div className="flex flex-col gap-1 mt-1">
                {admins.map((a) => (
                  <label key={a.id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={notifyList.includes(a.id)}
                      onChange={() => toggleNotifyAdmin(a.id)}
                      className="rounded"
                    />
                    {a.name} <span className="text-gray-400">({a.email})</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Lagre */}
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-lg transition-colors"
            >
              {saving ? 'Lagrer…' : 'Lagre'}
            </button>
            {saved && <span className="text-sm text-green-600">Lagret!</span>}
          </div>
        </div>
      </div>
    </div>
    </>
  )
}
