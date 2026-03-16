package com.scienta

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

@Serializable
data class HealthResponse(val status: String)

@Serializable
data class SyncResponse(val synced: Int)

@Serializable
data class CheckContractsResponse(val notified: Int)

fun Application.configureRouting(config: AppConfig) {
    install(StatusPages) {
        exception<Throwable> { call, cause ->
            call.respondText(text = "500: $cause", status = HttpStatusCode.InternalServerError)
        }
    }
    routing {
        get("/health") {
            call.respond(HealthResponse("ok"))
        }

        post("/sync") {
            call.authenticateFirebase() ?: return@post

            val allUsers = fetchFlowcaseUsers(config.flowcaseApiKey)
            val activeUsers = allUsers.filter { !it.deactivated }
            val activeIds = activeUsers.map { it.id }.toSet()
            val photoUrls = extractPhotoUrls(activeUsers)

            val firestore = getFirestore()

            // Upsert active consultants
            for (user in activeUsers) {
                val data = mapOf(
                    "flowcaseId" to user.id,
                    "name" to user.name,
                    "photoUrl" to (photoUrls[user.id] ?: "")
                )
                firestore.collection("consultants")
                    .document(user.id)
                    .set(data, com.google.cloud.firestore.SetOptions.merge())
                    .get()
            }

            // Delete consultants no longer active in Flowcase
            val existing = firestore.collection("consultants").get().get()
            for (doc in existing.documents) {
                if (doc.id !in activeIds) {
                    doc.reference.delete().get()
                }
            }

            call.respond(SyncResponse(activeUsers.size))
        }

        post("/check-contracts") {
            val secret = call.request.headers["X-Scheduler-Secret"]
            if (secret == null || secret != config.schedulerSecret) {
                call.respond(HttpStatusCode.Unauthorized, "Invalid scheduler secret")
                return@post
            }

            val notified = checkAndNotifyContracts()
            call.respond(CheckContractsResponse(notified))
        }
    }
}
