import { useEffect, useState } from 'react'
import { onAuthStateChanged, getIdToken } from 'firebase/auth'
import type { User } from 'firebase/auth'
import { doc, getDoc } from 'firebase/firestore'
import { auth, db } from '../firebase'

type AuthState = {
  user: User | null
  isAdmin: boolean
  loading: boolean
}

export function useAuth(): AuthState {
  const [state, setState] = useState<AuthState>({ user: null, isAdmin: false, loading: true })

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (!user) {
        setState({ user: null, isAdmin: false, loading: false })
        return
      }

      try {
        const adminDoc = await getDoc(doc(db, 'admins', user.uid))
        if (adminDoc.exists()) {
          setState({ user, isAdmin: true, loading: false })
          return
        }

        // Not yet an admin — check if there's a pending invite and promote
        const token = await getIdToken(user)
        const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/auth/promote`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) {
          const { promoted } = await res.json()
          setState({ user, isAdmin: promoted === true, loading: false })
        } else {
          setState({ user, isAdmin: false, loading: false })
        }
      } catch {
        setState({ user, isAdmin: false, loading: false })
      }
    })

    return unsubscribe
  }, [])

  return state
}
