package com.scienta

import com.google.cloud.Timestamp
import com.resend.services.emails.model.CreateEmailOptions
import java.time.LocalDate
import java.time.ZoneOffset

suspend fun checkAndNotifyContracts(): Int {
    val firestore = getFirestore()

    // Today's range in UTC (midnight to midnight)
    val todayStart = LocalDate.now(ZoneOffset.UTC).atStartOfDay(ZoneOffset.UTC).toInstant()
    val todayEnd = todayStart.plusSeconds(86400)

    val consultants = firestore.collection("consultants")
        .whereGreaterThanOrEqualTo("warningDate", Timestamp.ofTimeSecondsAndNanos(todayStart.epochSecond, 0))
        .whereLessThan("warningDate", Timestamp.ofTimeSecondsAndNanos(todayEnd.epochSecond, 0))
        .get().get().documents

    var notified = 0

    for (doc in consultants) {
        val name = doc.getString("name") ?: continue
        val clientId = doc.getString("clientId")
        val contractEnd = doc.getTimestamp("contractEnd")
        val notifyAll = doc.getBoolean("notifyAll") ?: true
        @Suppress("UNCHECKED_CAST")
        val notifyList = doc.get("notifyList") as? List<String> ?: emptyList()

        val clientName = if (clientId != null) {
            firestore.collection("clients").document(clientId).get().get()
                .getString("name") ?: "ukjent kunde"
        } else {
            "ukjent kunde"
        }

        val contractEndStr = contractEnd?.toDate()?.let {
            java.text.SimpleDateFormat("dd.MM.yyyy").apply {
                timeZone = java.util.TimeZone.getTimeZone("UTC")
            }.format(it)
        } ?: "ukjent dato"

        val recipients: List<String> = if (notifyAll) {
            firestore.collection("admins").get().get().documents
                .mapNotNull { it.getString("email") }
        } else {
            notifyList.mapNotNull { uid ->
                firestore.collection("admins").document(uid).get().get()
                    .getString("email")
            }
        }

        if (recipients.isEmpty()) continue

        val emailBody = """
            <p>Hei,</p>
            <p>Dette er en påminnelse om at kontrakten til <strong>$name</strong> hos <strong>$clientName</strong> utløper $contractEndStr.</p>
            <p>Logg inn for å se detaljer.</p>
        """.trimIndent()

        val emailRequest = CreateEmailOptions.builder()
            .from("onboarding@resend.dev")
            .to(recipients)
            .subject("Kontraktsvarsel: $name")
            .html(emailBody)
            .build()

        resendClient.emails().send(emailRequest)
        notified++
    }

    return notified
}
