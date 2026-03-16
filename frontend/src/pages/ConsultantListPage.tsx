import { useEffect, useState } from 'react'
import { collection, onSnapshot } from 'firebase/firestore'
import { getIdToken } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { db, auth } from '../firebase'

type Consultant = {
  id: string
  name: string
  photoUrl?: string
  clientId?: string
  contractEnd?: string
  warningDate?: string
}

type Client = {
  id: string
  name: string
}

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(dateStr)
  end.setHours(0, 0, 0, 0)
  return Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function rowColor(days: number): string {
  if (days <= 7) return 'bg-red-50 border-l-4 border-red-400'
  if (days <= 30) return 'bg-yellow-50 border-l-4 border-yellow-400'
  return 'bg-green-50 border-l-4 border-green-400'
}

export function ConsultantListPage() {
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [clients, setClients] = useState<Record<string, string>>({})
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const unsubConsultants = onSnapshot(collection(db, 'consultants'), (snap) => {
      setConsultants(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Consultant)))
    })
    const unsubClients = onSnapshot(collection(db, 'clients'), (snap) => {
      const map: Record<string, string> = {}
      snap.docs.forEach((d) => { map[d.id] = (d.data() as Client).name })
      setClients(map)
    })
    return () => { unsubConsultants(); unsubClients() }
  }, [])

  async function handleSync() {
    setSyncing(true)
    setSyncMsg('')
    try {
      const token = await getIdToken(auth.currentUser!)
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/sync`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const { synced } = await res.json()
      setSyncMsg(`${synced} konsulenter synkronisert.`)
    } catch {
      setSyncMsg('Synkronisering feilet.')
    } finally {
      setSyncing(false)
    }
  }

  const withContract = consultants
    .filter((c) => c.contractEnd)
    .sort((a, b) => new Date(a.contractEnd!).getTime() - new Date(b.contractEnd!).getTime())

  const withoutContract = consultants.filter((c) => !c.contractEnd)

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-semibold text-gray-800">Konsulenter</h1>
          <div className="flex items-center gap-3">
            {syncMsg && <span className="text-sm text-gray-600">{syncMsg}</span>}
            <button
              onClick={handleSync}
              disabled={syncing}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
            >
              {syncing && (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
              )}
              Synkroniser
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-4 py-3 font-medium">Konsulent</th>
                <th className="px-4 py-3 font-medium">Kunde</th>
                <th className="px-4 py-3 font-medium">Kontraktslutt</th>
                <th className="px-4 py-3 font-medium">Dager igjen</th>
              </tr>
            </thead>
            <tbody>
              {withContract.map((c) => {
                const days = daysUntil(c.contractEnd!)
                return (
                  <tr
                    key={c.id}
                    onClick={() => navigate(`/consultant/${c.id}`)}
                    className={`cursor-pointer hover:brightness-95 transition-all ${rowColor(days)}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {c.photoUrl ? (
                          <img src={c.photoUrl} alt={c.name} className="w-8 h-8 rounded-full object-cover" />
                        ) : (
                          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium text-xs">
                            {c.name?.charAt(0)}
                          </div>
                        )}
                        <span className="font-medium text-gray-800">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.clientId ? clients[c.clientId] ?? '–' : '–'}</td>
                    <td className="px-4 py-3 text-gray-600">{c.contractEnd}</td>
                    <td className="px-4 py-3 font-medium text-gray-800">{days}</td>
                  </tr>
                )
              })}
              {withoutContract.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/consultant/${c.id}`)}
                  className="cursor-pointer hover:bg-gray-50 transition-all border-t border-gray-100"
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {c.photoUrl ? (
                        <img src={c.photoUrl} alt={c.name} className="w-8 h-8 rounded-full object-cover" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-500 font-medium text-xs">
                          {c.name?.charAt(0)}
                        </div>
                      )}
                      <span className="font-medium text-gray-800">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-400">–</td>
                  <td className="px-4 py-3 text-gray-400">–</td>
                  <td className="px-4 py-3 text-gray-400">–</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
