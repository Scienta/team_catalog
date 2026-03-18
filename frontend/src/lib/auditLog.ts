import { collection, addDoc, serverTimestamp } from 'firebase/firestore'
import { db, auth } from '../firebase'

export async function writeAuditLog(
  action: string,
  targetType: string,
  targetId: string,
  details: Record<string, unknown> = {}
) {
  const user = auth.currentUser
  if (!user) return
  try {
    await addDoc(collection(db, 'auditLog'), {
      timestamp: serverTimestamp(),
      adminUid: user.uid,
      adminEmail: user.email ?? '',
      action,
      targetType,
      targetId,
      details,
    })
  } catch (e) {
    console.error('Failed to write audit log:', e)
  }
}
