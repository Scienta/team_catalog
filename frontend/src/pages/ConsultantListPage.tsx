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

type Client = { id: string; name: string }

function daysUntil(dateStr: string): number {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const end = new Date(dateStr)
  end.setHours(0, 0, 0, 0)
  return Math.round((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
}

function statusStyle(days: number) {
  if (days <= 7) return {
    row: 'border-l-2 border-red-400 bg-red-50/60 dark:bg-red-950/30',
    badge: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400',
    label: days < 0 ? 'Utløpt' : `${days}d`
  }
  if (days <= 30) return {
    row: 'border-l-2 border-amber-400 bg-amber-50/60 dark:bg-amber-950/30',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400',
    label: `${days}d`
  }
  return {
    row: 'border-l-2 border-emerald-400 bg-emerald-50/40 dark:bg-emerald-950/20',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400',
    label: `${days}d`
  }
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
      setSyncMsg(`${synced} synkronisert`)
    } catch {
      setSyncMsg('Feilet')
    } finally {
      setSyncing(false)
    }
  }

  const withContract = consultants
    .filter((c) => c.contractEnd)
    .sort((a, b) => new Date(a.contractEnd!).getTime() - new Date(b.contractEnd!).getTime())

  const withoutContract = consultants
    .filter((c) => !c.contractEnd)
    .sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Konsulenter</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{consultants.length} totalt</p>
        </div>
        <div className="flex items-center gap-3">
          {syncMsg && <span className="text-xs text-gray-400 dark:text-gray-500">{syncMsg}</span>}
          <button
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-40 text-white dark:text-gray-900 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
          >
            {syncing && (
              <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
              </svg>
            )}
            Synkroniser
          </button>
        </div>
      </div>

      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 overflow-hidden shadow-sm transition-colors duration-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 dark:text-gray-600 uppercase tracking-wider">Konsulent</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 dark:text-gray-600 uppercase tracking-wider">Kunde</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 dark:text-gray-600 uppercase tracking-wider">Kontraktslutt</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 dark:text-gray-600 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody>
            {withContract.map((c) => {
              const days = daysUntil(c.contractEnd!)
              const { row, badge, label } = statusStyle(days)
              return (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/consultant/${c.id}`)}
                  className={`cursor-pointer transition-all hover:brightness-95 dark:hover:brightness-110 ${row}`}
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {c.photoUrl ? (
                        <img src={c.photoUrl} alt={c.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-500 dark:text-gray-400 font-medium text-xs flex-shrink-0">
                          {c.name?.charAt(0)}
                        </div>
                      )}
                      <span className="font-medium text-gray-800 dark:text-gray-200">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400">{c.clientId ? clients[c.clientId] ?? '–' : '–'}</td>
                  <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400">{c.contractEnd}</td>
                  <td className="px-5 py-3.5">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-semibold ${badge}`}>
                      {label}
                    </span>
                  </td>
                </tr>
              )
            })}
            {withoutContract.map((c, i) => (
              <tr
                key={c.id}
                onClick={() => navigate(`/consultant/${c.id}`)}
                className={`cursor-pointer transition-all hover:bg-gray-50/80 dark:hover:bg-gray-800/40 ${i === 0 && withContract.length > 0 ? 'border-t-2 border-gray-100 dark:border-gray-800' : ''}`}
              >
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-3">
                    {c.photoUrl ? (
                      <img src={c.photoUrl} alt={c.name} className="w-8 h-8 rounded-full object-cover flex-shrink-0" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-600 font-medium text-xs flex-shrink-0">
                        {c.name?.charAt(0)}
                      </div>
                    )}
                    <span className="font-medium text-gray-600 dark:text-gray-400">{c.name}</span>
                  </div>
                </td>
                <td className="px-5 py-3.5 text-gray-400 dark:text-gray-600">–</td>
                <td className="px-5 py-3.5 text-gray-400 dark:text-gray-600">–</td>
                <td className="px-5 py-3.5 text-gray-300 dark:text-gray-700 text-xs">Ingen kontrakt</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
