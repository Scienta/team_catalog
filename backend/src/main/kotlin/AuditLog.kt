package com.scienta

import com.google.cloud.firestore.FieldValue

suspend fun writeAuditLog(
    adminUid: String,
    adminEmail: String = "",
    action: String,
    targetType: String,
    targetId: String,
    details: Map<String, Any> = emptyMap()
) {
    val firestore = getFirestore()
    val entry = mutableMapOf<String, Any>(
        "timestamp" to FieldValue.serverTimestamp(),
        "adminUid" to adminUid,
        "adminEmail" to adminEmail,
        "action" to action,
        "targetType" to targetType,
        "targetId" to targetId
    )
    if (details.isNotEmpty()) entry["details"] = details
    firestore.collection("auditLog").add(entry).get()
}
