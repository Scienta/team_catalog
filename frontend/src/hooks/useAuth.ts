import { useEffect, useState } from 'react'
import { onAuthStateChanged } from 'firebase/auth'
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

      const adminDoc = await getDoc(doc(db, 'admins', user.uid))
      setState({ user, isAdmin: adminDoc.exists(), loading: false })
    })

    return unsubscribe
  }, [])

  return state
}
