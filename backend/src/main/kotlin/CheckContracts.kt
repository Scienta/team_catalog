package com.scienta

import com.resend.services.emails.model.CreateEmailOptions
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

suspend fun checkAndNotifyContracts(overrideDate: LocalDate? = null, appUrl: String = ""): Int {
    val firestore = getFirestore()
    val today = overrideDate ?: LocalDate.now(ZoneOffset.UTC)
    val fmt = DateTimeFormatter.ISO_LOCAL_DATE

    // Fetch all consultants with both contractEnd and warningDays set
    val allConsultants = firestore.collection("consultants").get().get().documents

    val toNotify = allConsultants.filter { doc ->
        val contractEndStr = doc.getString("contractEnd") ?: return@filter false
        val warningDays = doc.getLong("warningDays") ?: return@filter false
        val contractEnd = runCatching { LocalDate.parse(contractEndStr, fmt) }.getOrNull() ?: return@filter false
        contractEnd.minusDays(warningDays) == today
    }

    // Pre-fetch to eliminate N+1 queries
    val allClients = firestore.collection("clients").get().get().documents
        .associate { it.id to (it.getString("name") ?: "") }
    val adminDocs = firestore.collection("admins").get().get().documents
    val allAdminEmails = adminDocs.mapNotNull { it.getString("email") }
    val adminEmailByUid = adminDocs.associate { it.id to (it.getString("email") ?: "") }

    var notified = 0

    for (doc in toNotify) {
        val name = doc.getString("name") ?: continue
        val contractEndStr = doc.getString("contractEnd") ?: continue
        val contractEnd = runCatching { LocalDate.parse(contractEndStr, fmt) }.getOrNull() ?: continue
        val warningDays = doc.getLong("warningDays") ?: continue

        // Idempotency: skip if we already sent for today
        val lastNotifiedDate = doc.getString("lastNotifiedDate")
        if (lastNotifiedDate == today.toString()) continue

        val notifyAll = doc.getBoolean("notifyAll") ?: true
        val notifyList = (doc.get("notifyList") as? List<*>)?.filterIsInstance<String>() ?: emptyList()

        // Find client names via projects (projects already fetched, clients pre-fetched above)
        val projects = firestore.collection("projects")
            .whereArrayContains("consultantIds", doc.id)
            .get().get().documents
        val clientNames = projects.mapNotNull { p ->
            val clientId = p.getString("clientId") ?: return@mapNotNull null
            allClients[clientId]
        }.distinct()
        val clientStr = clientNames.joinToString(", ").ifBlank { "ukjent kunde" }

        val contractEndFormatted = contractEnd.format(DateTimeFormatter.ofPattern("dd.MM.yyyy"))

        val recipients: List<String> = if (notifyAll) {
            allAdminEmails
        } else {
            notifyList.mapNotNull { uid -> adminEmailByUid[uid]?.takeIf { it.isNotEmpty() } }
        }

        if (recipients.isEmpty()) continue

        val emailRequest = CreateEmailOptions.builder()
            .from("onboarding@resend.dev")
            .to(recipients)
            .subject("Kontraktsvarsel: $name utløper om $warningDays dager")
            .html(contractWarningEmail(name, clientStr, contractEndFormatted, warningDays, appUrl))
            .build()

        resendClient.emails().send(emailRequest)
        firestore.collection("consultants").document(doc.id)
            .update("lastNotifiedDate", today.toString())
            .get()
        notified++
    }

    return notified
}
