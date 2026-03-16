import { useEffect, useState } from 'react'
import { collection, onSnapshot, addDoc } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase'

type Client = { id: string; name: string; description?: string; slackChannel?: string; contactName?: string; contactEmail?: string; contactPhone?: string; logoUrl?: string }

export function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [saving, setSaving] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    return onSnapshot(collection(db, 'clients'), (snap) => {
      setClients(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Client)).sort((a, b) => a.name.localeCompare(b.name)))
    })
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    const ref = await addDoc(collection(db, 'clients'), { name })
    setSaving(false)
    setName('')
    setShowForm(false)
    navigate(`/clients/${ref.id}`)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Kunder</h1>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{clients.length} totalt</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 text-white dark:text-gray-900 text-sm font-medium px-4 py-2 rounded-xl transition-colors"
        >
          + Ny kunde
        </button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 w-full max-w-sm p-6">
            <h2 className="text-base font-semibold text-gray-900 dark:text-white mb-4">Ny kunde</h2>
            <form onSubmit={handleAdd} className="flex flex-col gap-3">
              <input
                type="text"
                required
                autoFocus
                placeholder="Kundenavn"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm bg-white dark:bg-[#222] text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white w-full"
              />
              <div className="flex gap-2 justify-end pt-1">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-sm text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-xl transition-colors">Avbryt</button>
                <button type="submit" disabled={saving} className="px-4 py-2 text-sm font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-40 rounded-xl transition-colors">
                  {saving ? 'Lagrer…' : 'Opprett'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden">
        {clients.length === 0 ? (
          <div className="px-5 py-12 text-center text-sm text-gray-400 dark:text-gray-600">Ingen kunder ennå</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-gray-800">
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 dark:text-gray-600 uppercase tracking-wider">Kunde</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 dark:text-gray-600 uppercase tracking-wider">Kontaktperson</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 dark:text-gray-600 uppercase tracking-wider">Slack</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((c) => (
                <tr
                  key={c.id}
                  onClick={() => navigate(`/clients/${c.id}`)}
                  className="border-t border-gray-100 dark:border-gray-800 cursor-pointer hover:bg-gray-50/80 dark:hover:bg-gray-800/40 transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      {c.logoUrl ? (
                        <img src={c.logoUrl} alt={c.name} className="w-7 h-7 object-contain rounded flex-shrink-0" />
                      ) : (
                        <div className="w-7 h-7 rounded bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-400 dark:text-gray-600 text-xs font-semibold flex-shrink-0">{c.name.charAt(0)}</div>
                      )}
                      <span className="font-medium text-gray-800 dark:text-gray-200">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400">{c.contactName || '–'}</td>
                  <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400">{c.slackChannel ? `#${c.slackChannel}` : '–'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
