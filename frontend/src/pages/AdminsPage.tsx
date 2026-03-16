import { useEffect, useState } from 'react'
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore'
import { getIdToken } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'
import { db, auth } from '../firebase'
import { useAuth } from '../hooks/useAuth'

type Admin = { id: string; name: string; email: string }

export function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [email, setEmail] = useState('')
  const [error, setError] = useState('')
  const [adding, setAdding] = useState(false)
  const { user } = useAuth()
  const navigate = useNavigate()

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
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      if (res.status === 404) {
        setError('Ingen bruker funnet med denne e-posten. Brukeren må logge inn én gang først.')
        return
      }
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

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-xl mx-auto">
        <button
          onClick={() => navigate('/')}
          className="text-sm text-blue-600 hover:underline mb-6 inline-block"
        >
          ← Tilbake
        </button>

        <h1 className="text-2xl font-semibold text-gray-800 mb-6">Administratorer</h1>

        {/* Eksisterende admins */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden mb-6">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="px-4 py-3 font-medium">Navn</th>
                <th className="px-4 py-3 font-medium">E-post</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {admins.map((a) => (
                <tr key={a.id} className="border-t border-gray-100">
                  <td className="px-4 py-3 text-gray-800">{a.name}</td>
                  <td className="px-4 py-3 text-gray-600">{a.email}</td>
                  <td className="px-4 py-3 text-right">
                    {a.id !== user?.uid && (
                      <button
                        onClick={() => handleRemove(a.id)}
                        className="text-red-500 hover:text-red-700 text-xs font-medium"
                      >
                        Fjern
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Legg til ny admin */}
        <div className="bg-white rounded-2xl shadow-sm p-6">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Legg til administrator</h2>
          <form onSubmit={handleAdd} className="flex flex-col gap-3">
            <input
              type="email"
              required
              placeholder="navn@scienta.no"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <button
              type="submit"
              disabled={adding}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors self-start"
            >
              {adding ? 'Søker…' : 'Legg til'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
