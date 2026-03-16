import { useEffect, useState } from 'react'
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore'
import { getIdToken } from 'firebase/auth'
import { db, auth } from '../firebase'
import { useAuth } from '../hooks/useAuth'

type Admin = { id: string; name: string; email: string }

export function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const { user } = useAuth()

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'admins'), (snap) => {
      setAdmins(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Admin)))
    })
    return unsub
  }, [])

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setAdding(true)
    try {
      const token = await getIdToken(auth.currentUser!)
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/lookup-user`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      })
      if (res.status === 404) { setError('Ingen bruker funnet. Brukeren må logge inn én gang først.'); return }
      if (!res.ok) throw new Error()
      const { uid, name, email: resolvedEmail } = await res.json()
      await setDoc(doc(db, 'admins', uid), { name, email: resolvedEmail })
      setEmail('')
    } catch {
      setError('Noe gikk galt. Prøv igjen.')
    } finally {
      setAdding(false)
    }
  }

  async function handleRemove(adminId: string) {
    await deleteDoc(doc(db, 'admins', adminId))
  }

  const inputClass = "border border-gray-200 dark:border-gray-700 rounded-xl px-3 py-2.5 text-sm text-gray-800 dark:text-gray-200 bg-white dark:bg-[#222] focus:outline-none focus:ring-2 focus:ring-gray-900 dark:focus:ring-white focus:border-transparent transition-all w-full placeholder:text-gray-400 dark:placeholder:text-gray-600"

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Administratorer</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{admins.length} admin{admins.length !== 1 ? 's' : ''}</p>
      </div>

      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden mb-5 transition-colors duration-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-gray-800">
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 dark:text-gray-600 uppercase tracking-wider">Navn</th>
              <th className="px-5 py-3 text-left text-xs font-medium text-gray-400 dark:text-gray-600 uppercase tracking-wider">E-post</th>
              <th className="px-5 py-3" />
            </tr>
          </thead>
          <tbody>
            {admins.map((a) => (
              <tr key={a.id} className="border-t border-gray-100 dark:border-gray-800 hover:bg-gray-50/60 dark:hover:bg-gray-800/40 transition-colors">
                <td className="px-5 py-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-gray-900 dark:bg-white flex items-center justify-center text-white dark:text-gray-900 text-xs font-semibold flex-shrink-0">
                      {a.name?.charAt(0)}
                    </div>
                    <span className="font-medium text-gray-800 dark:text-gray-200">{a.name}</span>
                    {a.id === user?.uid && (
                      <span className="text-xs text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">deg</span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-3.5 text-gray-500 dark:text-gray-400">{a.email}</td>
                <td className="px-5 py-3.5 text-right">
                  {a.id !== user?.uid && (
                    <button onClick={() => handleRemove(a.id)} className="text-xs text-gray-400 dark:text-gray-600 hover:text-red-500 dark:hover:text-red-400 transition-colors font-medium">
                      Fjern
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm p-6 transition-colors duration-200">
        <h2 className="text-xs font-medium text-gray-500 dark:text-gray-500 uppercase tracking-wider mb-4">Legg til administrator</h2>
        <form onSubmit={handleAdd} className="flex flex-col gap-3">
          <input type="email" required placeholder="navn@scienta.no" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
          {error && <p className="text-xs text-red-500 dark:text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={adding}
            className="bg-gray-900 dark:bg-white hover:bg-gray-800 dark:hover:bg-gray-100 disabled:opacity-40 text-white dark:text-gray-900 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors self-start"
          >
            {adding ? 'Søker…' : 'Legg til'}
          </button>
        </form>
      </div>
    </div>
  )
}
