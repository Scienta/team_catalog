import { useEffect, useState } from 'react'
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore'
import { getIdToken } from 'firebase/auth'
import { db, auth } from '../firebase'
import { useAuth } from '../hooks/useAuth'

function DevTools() {
  const [testEmail, setTestEmail] = useState('')
  const [testEmailStatus, setTestEmailStatus] = useState<'idle' | 'loading' | 'ok' | 'error'>('idle')
  const [checkDate, setCheckDate] = useState(new Date().toISOString().split('T')[0])
  const [checkStatus, setCheckStatus] = useState<{ state: 'idle' | 'loading' | 'ok' | 'error'; message?: string }>({ state: 'idle' })

  async function sendTestEmail() {
    if (!testEmail) return
    setTestEmailStatus('loading')
    try {
      const token = await getIdToken(auth.currentUser!)
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/test-email`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: testEmail }),
      })
      setTestEmailStatus(res.ok ? 'ok' : 'error')
    } catch {
      setTestEmailStatus('error')
    }
  }

  async function simulateCheckContracts() {
    setCheckStatus({ state: 'loading' })
    try {
      const token = await getIdToken(auth.currentUser!)
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/check-contracts?date=${checkDate}`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) throw new Error()
      const data = await res.json()
      setCheckStatus({ state: 'ok', message: `${data.notified} varsler sendt for ${data.date}` })
    } catch {
      setCheckStatus({ state: 'error', message: 'Noe gikk galt' })
    }
  }

  return (
    <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-dashed border-gray-300 dark:border-gray-700 overflow-hidden">
      <div className="px-5 py-3 border-b border-dashed border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-900/30 flex items-center gap-2">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-400">
          <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
        </svg>
        <span className="text-xs font-medium text-gray-400 dark:text-gray-600 uppercase tracking-wider">Dev-verktøy</span>
      </div>

      <div className="p-5 flex flex-col gap-5">
        {/* Test email */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Send test-epost</p>
          <p className="text-xs text-gray-400 dark:text-gray-600">Verifiser at Resend-integrasjonen fungerer ved å sende en enkel epost.</p>
          <div className="flex gap-2 mt-1">
            <input
              type="email"
              placeholder="din@epost.no"
              value={testEmail}
              onChange={(e) => { setTestEmail(e.target.value); setTestEmailStatus('idle') }}
              className="flex-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
            <button
              onClick={sendTestEmail}
              disabled={!testEmail || testEmailStatus === 'loading'}
              className="text-xs font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-40 px-4 py-2 rounded-lg transition-colors flex-shrink-0"
            >
              {testEmailStatus === 'loading' ? '…' : 'Send'}
            </button>
          </div>
          {testEmailStatus === 'ok' && <p className="text-xs text-green-600 dark:text-green-400">Sendt! Sjekk innboksen (og spam).</p>}
          {testEmailStatus === 'error' && <p className="text-xs text-red-500">Noe gikk galt. Sjekk Resend-dashboardet.</p>}
        </div>

        <div className="border-t border-gray-100 dark:border-gray-800" />

        {/* Simulate contract check */}
        <div className="flex flex-col gap-2">
          <p className="text-xs font-medium text-gray-600 dark:text-gray-400">Simuler kontraktssjekk</p>
          <p className="text-xs text-gray-400 dark:text-gray-600">Kjør <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">/check-contracts</code> med en bestemt dato for å teste varsling.</p>
          <div className="flex gap-2 mt-1">
            <input
              type="date"
              value={checkDate}
              onChange={(e) => { setCheckDate(e.target.value); setCheckStatus({ state: 'idle' }) }}
              className="flex-1 text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 text-gray-800 dark:text-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-400"
            />
            <button
              onClick={simulateCheckContracts}
              disabled={checkStatus.state === 'loading'}
              className="text-xs font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-40 px-4 py-2 rounded-lg transition-colors flex-shrink-0"
            >
              {checkStatus.state === 'loading' ? '…' : 'Kjør'}
            </button>
          </div>
          {checkStatus.state === 'ok' && <p className="text-xs text-green-600 dark:text-green-400">{checkStatus.message}</p>}
          {checkStatus.state === 'error' && <p className="text-xs text-red-500">{checkStatus.message}</p>}
        </div>
      </div>
    </div>
  )
}

type Admin = { id: string; name: string; email: string }
type PendingAdmin = { id: string; name: string; email: string }
type Consultant = { id: string; name: string; photoUrl?: string; email?: string; isInternal?: boolean }

function Avatar({ name, photoUrl, size = 'sm' }: { name: string; photoUrl?: string; size?: 'sm' | 'md' }) {
  const cls = size === 'md' ? 'w-9 h-9 text-sm' : 'w-7 h-7 text-xs'
  return photoUrl
    ? <img src={photoUrl} alt={name} className={`${cls} rounded-full object-cover flex-shrink-0`} />
    : <div className={`${cls} rounded-full bg-gray-900 dark:bg-white flex items-center justify-center text-white dark:text-gray-900 font-semibold flex-shrink-0`}>{name?.charAt(0)}</div>
}

export function AdminsPage() {
  const [admins, setAdmins] = useState<Admin[]>([])
  const [pendingAdmins, setPendingAdmins] = useState<PendingAdmin[]>([])
  const [consultants, setConsultants] = useState<Consultant[]>([])
  const [adding, setAdding] = useState<string | null>(null)
  const [confirmRemove, setConfirmRemove] = useState<{ type: 'admin'; id: string; name: string } | { type: 'pending'; email: string; name: string } | null>(null)
  const { user } = useAuth()

  useEffect(() => {
    const u1 = onSnapshot(collection(db, 'admins'), (snap) =>
      setAdmins(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Admin))))
    const u2 = onSnapshot(collection(db, 'pendingAdmins'), (snap) =>
      setPendingAdmins(snap.docs.map((d) => ({ id: d.id, ...d.data() } as PendingAdmin))))
    const u3 = onSnapshot(collection(db, 'consultants'), (snap) =>
      setConsultants(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Consultant))))
    return () => { u1(); u2(); u3() }
  }, [])

  // Internal consultants not yet granted admin access
  const adminEmails = new Set([
    ...admins.map((a) => a.email),
    ...pendingAdmins.map((p) => p.email),
  ])
  const internalNotAdmin = consultants
    .filter((c) => c.isInternal && c.email && !adminEmails.has(c.email))
    .sort((a, b) => a.name.localeCompare(b.name))

  async function grantAccess(consultant: Consultant) {
    if (!consultant.email) return
    setAdding(consultant.id)
    try {
      const token = await getIdToken(auth.currentUser!)
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/admin/lookup-user`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: consultant.email }),
      })
      if (!res.ok) throw new Error()
      const { uid, name, email } = await res.json()
      if (uid) {
        // Already in Firebase Auth — add directly
        await setDoc(doc(db, 'admins', uid), { name, email })
      }
      // If uid is empty, backend already wrote to pendingAdmins
    } catch (e) {
      console.error('Failed to grant admin access:', e)
    } finally {
      setAdding(null)
    }
  }

  async function handleConfirmRemove() {
    if (!confirmRemove) return
    if (confirmRemove.type === 'admin') await deleteDoc(doc(db, 'admins', confirmRemove.id))
    else await deleteDoc(doc(db, 'pendingAdmins', confirmRemove.email))
    setConfirmRemove(null)
  }

  // Find photo for an admin by matching email to consultant
  function getPhoto(email: string): string | undefined {
    return consultants.find((c) => c.email === email)?.photoUrl
  }

  return (
    <div className="max-w-xl flex flex-col gap-6">
      {confirmRemove && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm" onClick={() => setConfirmRemove(null)}>
          <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-200 dark:border-gray-700 shadow-2xl p-6 w-full max-w-sm mx-4" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/40 flex items-center justify-center flex-shrink-0">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-red-600 dark:text-red-400">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="23" y1="11" x2="17" y2="11"/>
                </svg>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">Fjern «{confirmRemove.name}»?</p>
                <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                  {confirmRemove.type === 'pending' ? 'Sletter venteliste-invitasjonen' : 'Fjerner admin-tilgangen'}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={handleConfirmRemove} className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
                Ja, fjern
              </button>
              <button onClick={() => setConfirmRemove(null)} className="flex-1 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium px-4 py-2.5 rounded-xl transition-colors">
                Avbryt
              </button>
            </div>
          </div>
        </div>
      )}
      <div>
        <h1 className="text-xl font-semibold text-gray-900 dark:text-white">Administratorer</h1>
        <p className="text-sm text-gray-400 dark:text-gray-500 mt-0.5">{admins.length} aktive admins</p>
      </div>

      {/* Active admins */}
      <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden transition-colors">
        <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
          <span className="text-xs font-medium text-gray-400 dark:text-gray-600 uppercase tracking-wider">Aktive admins</span>
        </div>
        {admins.map((a) => (
          <div key={a.id} className="flex items-center gap-3 px-5 py-3.5 border-t border-gray-100 dark:border-gray-800 first:border-t-0">
            <Avatar name={a.name} photoUrl={getPhoto(a.email)} size="md" />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{a.name}</span>
                {a.id === user?.uid && (
                  <span className="text-xs text-gray-400 dark:text-gray-600 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded-full">deg</span>
                )}
              </div>
              <span className="text-xs text-gray-400 dark:text-gray-500">{a.email}</span>
            </div>
            {a.id !== user?.uid && (
              <button onClick={() => setConfirmRemove({ type: 'admin', id: a.id, name: a.name })} className="text-xs text-gray-300 dark:text-gray-700 hover:text-red-500 dark:hover:text-red-400 transition-colors font-medium flex-shrink-0">
                Fjern
              </button>
            )}
          </div>
        ))}
        {admins.length === 0 && (
          <div className="px-5 py-8 text-center text-sm text-gray-400 dark:text-gray-600">Ingen admins ennå</div>
        )}
      </div>

      {/* Pending admins */}
      {pendingAdmins.length > 0 && (
        <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-amber-200 dark:border-amber-900/50 shadow-sm overflow-hidden transition-colors">
          <div className="px-5 py-3 border-b border-amber-100 dark:border-amber-900/30 bg-amber-50/50 dark:bg-amber-950/20">
            <span className="text-xs font-medium text-amber-600 dark:text-amber-500 uppercase tracking-wider">Venter på første innlogging</span>
          </div>
          {pendingAdmins.map((p) => (
            <div key={p.id} className="flex items-center gap-3 px-5 py-3.5 border-t border-gray-100 dark:border-gray-800 first:border-t-0">
              <Avatar name={p.name} photoUrl={getPhoto(p.email)} size="md" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{p.name}</span>
                <p className="text-xs text-gray-400 dark:text-gray-500">{p.email}</p>
              </div>
              <span className="text-xs bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400 px-2 py-0.5 rounded-full flex-shrink-0">Venter</span>
              <button onClick={() => setConfirmRemove({ type: 'pending', email: p.email, name: p.name })} className="text-xs text-gray-300 dark:text-gray-700 hover:text-red-500 dark:hover:text-red-400 transition-colors font-medium flex-shrink-0">
                Fjern
              </button>
            </div>
          ))}
        </div>
      )}

      <DevTools />

      {/* Internal consultants — grant access */}
      {internalNotAdmin.length > 0 && (
        <div className="bg-white dark:bg-[#1a1a1a] rounded-2xl border border-gray-100 dark:border-gray-800 shadow-sm overflow-hidden transition-colors">
          <div className="px-5 py-3 border-b border-gray-100 dark:border-gray-800">
            <span className="text-xs font-medium text-gray-400 dark:text-gray-600 uppercase tracking-wider">Interne ansatte — gi admin-tilgang</span>
          </div>
          {internalNotAdmin.map((c) => (
            <div key={c.id} className="flex items-center gap-3 px-5 py-3.5 border-t border-gray-100 dark:border-gray-800 first:border-t-0">
              <Avatar name={c.name} photoUrl={c.photoUrl} size="md" />
              <div className="flex-1 min-w-0">
                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{c.name}</span>
                {c.email && <p className="text-xs text-gray-400 dark:text-gray-500">{c.email}</p>}
              </div>
              <button
                onClick={() => grantAccess(c)}
                disabled={adding === c.id}
                className="text-xs font-medium bg-gray-900 dark:bg-white text-white dark:text-gray-900 hover:bg-gray-700 dark:hover:bg-gray-100 disabled:opacity-40 px-3 py-1.5 rounded-lg transition-colors flex-shrink-0"
              >
                {adding === c.id ? '…' : 'Gi tilgang'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
