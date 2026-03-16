package com.scienta

import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.auth.UserRecord
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.statuspages.*
import io.ktor.server.request.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import kotlinx.serialization.Serializable

@Serializable
data class HealthResponse(val status: String)

@Serializable
data class SyncResponse(val synced: Int)

@Serializable
data class CheckContractsResponse(val notified: Int)

@Serializable
data class LookupUserRequest(val email: String)

@Serializable
data class LookupUserResponse(val uid: String, val name: String, val email: String)

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
                    "photoUrl" to (photoUrls[user.id] ?: ""),
                    "email" to (user.email ?: ""),
                    "telephone" to (user.telephone ?: "")
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

        post("/admin/lookup-user") {
            call.authenticateFirebase() ?: return@post

            val body = call.receive<LookupUserRequest>()
            val firestore = getFirestore()
            val user: UserRecord? = try {
                FirebaseAuth.getInstance().getUserByEmail(body.email)
            } catch (e: Exception) {
                null
            }

            if (user == null) {
                // User hasn't signed in yet — store as pending admin
                val name = body.email.substringBefore('@')
                    .split('.', '-', '_')
                    .joinToString(" ") { it.replaceFirstChar { c -> c.uppercase() } }
                firestore.collection("pendingAdmins")
                    .document(body.email)
                    .set(mapOf("email" to body.email, "name" to name))
                    .get()
                call.respond(LookupUserResponse(uid = "", name = name, email = body.email))
                return@post
            }

            call.respond(LookupUserResponse(
                uid = user.uid,
                name = user.displayName ?: "",
                email = user.email ?: body.email
            ))
        }

        post("/auth/promote") {
            // Any authenticated user can call this — promotes them if they're in pendingAdmins
            val firebaseUid = call.verifyFirebaseToken() ?: return@post
            val firebaseToken = FirebaseAuth.getInstance().getUser(firebaseUid)
            val email = firebaseToken.email ?: run {
                call.respond(HttpStatusCode.BadRequest, "No email on account")
                return@post
            }

            val firestore = getFirestore()
            val pending = firestore.collection("pendingAdmins").document(email).get().get()
            if (!pending.exists()) {
                call.respond(mapOf("promoted" to false))
                return@post
            }

            val name = pending.getString("name") ?: email.substringBefore('@')
            firestore.collection("admins").document(firebaseUid)
                .set(mapOf("name" to name, "email" to email))
                .get()
            firestore.collection("pendingAdmins").document(email).delete().get()
            call.respond(mapOf("promoted" to true))
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
