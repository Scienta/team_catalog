package com.scienta

import com.google.cloud.firestore.FieldValue
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
data class SyncResponse(val synced: Int, val deleted: Int)

@Serializable
data class CheckContractsResponse(val notified: Int, val date: String)

@Serializable
data class TestEmailRequest(val to: String)

@Serializable
data class TestEmailResponse(val sent: Boolean)

@Serializable
data class LookupUserRequest(val email: String)

@Serializable
data class LookupUserResponse(val uid: String, val name: String, val email: String)

@Serializable
data class CVWorkEntry(val id: String, val employer: String?, val description: String?, val yearFrom: Int?, val monthFrom: Int?, val yearTo: Int?, val monthTo: Int?)

@Serializable
data class CVProjectEntry(val id: String, val customer: String?, val roles: List<String>, val description: String?, val yearFrom: Int?, val monthFrom: Int?, val yearTo: Int?, val monthTo: Int?)

@Serializable
data class CVEducationEntry(val id: String, val school: String?, val degree: String?, val yearFrom: Int?, val yearTo: Int?)

@Serializable
data class CVTechGroup(val label: String?, val tags: List<String>)

@Serializable
data class CVKeyQual(val label: String?, val description: String?)

@Serializable
data class ConsultantCVResponse(
    val workExperience: List<CVWorkEntry>,
    val projectExperience: List<CVProjectEntry>,
    val education: List<CVEducationEntry>,
    val technologies: List<CVTechGroup>,
    val keyQualifications: List<CVKeyQual>
)

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
            val adminUid = call.authenticateFirebase() ?: return@post

            val allUsers = fetchFlowcaseUsers(config.flowcaseApiKey)
            val activeUsers = allUsers.filter { !it.deactivated }
            val activeIds = activeUsers.map { it.id }.toSet()
            val photoUrls = extractPhotoUrls(activeUsers)

            val firestore = getFirestore()
            val adminEmail = firestore.collection("admins").document(adminUid).get().get().getString("email") ?: ""

            // Upsert active consultants (fetch CV to extract filterable fields)
            for (user in activeUsers) {
                val cv = try { fetchConsultantCV(config.flowcaseApiKey, user.id, user.default_cv_id) } catch (_: Exception) { null }
                val techTags: List<String> = cv?.technologies
                    ?.filter { it.disabled != true }
                    ?.flatMap { group -> group.technology_skills.mapNotNull { skill -> skill.tags?.text() } }
                    ?: emptyList()
                val projectCustomers: List<String> = cv?.project_experiences
                    ?.filter { it.disabled != true }
                    ?.mapNotNull { it.customer?.text() }
                    ?.distinct()
                    ?: emptyList()
                val employers: List<String> = cv?.work_experiences
                    ?.filter { it.disabled != true }
                    ?.mapNotNull { it.employer?.text() }
                    ?.distinct()
                    ?: emptyList()
                val schools: List<String> = cv?.educations
                    ?.filter { it.disabled != true }
                    ?.mapNotNull { it.school?.text() }
                    ?.distinct()
                    ?: emptyList()

                val data = mapOf(
                    "flowcaseId" to user.id,
                    "name" to user.name,
                    "photoUrl" to (photoUrls[user.id] ?: ""),
                    "email" to (user.email ?: ""),
                    "telephone" to (user.telephone ?: ""),
                    "defaultCvId" to (user.default_cv_id ?: ""),
                    "technologies" to techTags,
                    "projectCustomers" to projectCustomers,
                    "employers" to employers,
                    "schools" to schools,
                    "lastSyncedAt" to FieldValue.serverTimestamp()
                )
                firestore.collection("consultants")
                    .document(user.id)
                    .set(data, com.google.cloud.firestore.SetOptions.merge())
                    .get()
            }

            // Delete consultants no longer active in Flowcase — remove all personal data
            val existing = firestore.collection("consultants").get().get()
            var deleted = 0
            for (doc in existing.documents) {
                if (doc.id !in activeIds) {
                    val batch = firestore.batch()

                    // Remove consultant from every project that references them
                    val projectsWithConsultant = firestore.collection("projects")
                        .whereArrayContains("consultantIds", doc.id)
                        .get().get()
                    for (project in projectsWithConsultant.documents) {
                        batch.update(project.reference, "consultantIds", FieldValue.arrayRemove(doc.id))
                    }

                    // Delete the consultant document (all personal data)
                    batch.delete(doc.reference)
                    batch.commit().get()
                    deleted++
                }
            }

            writeAuditLog(
                adminUid = adminUid,
                adminEmail = adminEmail,
                action = "SYNC",
                targetType = "system",
                targetId = "flowcase",
                details = mapOf("synced" to activeUsers.size, "deleted" to deleted)
            )

            call.respond(SyncResponse(synced = activeUsers.size, deleted = deleted))
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

        get("/cv/{consultantId}") {
            call.authenticateFirebase() ?: return@get

            val consultantId = call.parameters["consultantId"] ?: run {
                call.respond(HttpStatusCode.BadRequest, "Missing consultantId")
                return@get
            }

            val consultantDoc = getFirestore().collection("consultants").document(consultantId).get().get()
            val defaultCvId = consultantDoc.getString("defaultCvId")

            val cv = fetchConsultantCV(config.flowcaseApiKey, consultantId, defaultCvId)
            if (cv == null) {
                call.respond(ConsultantCVResponse(emptyList(), emptyList(), emptyList(), emptyList(), emptyList()))
                return@get
            }

            // Cache CV fields in Firestore so list page can filter without fetching CVs
            val techTags: List<String> = cv.technologies.filter { it.disabled != true }
                .flatMap { group -> group.technology_skills.mapNotNull { skill -> skill.tags?.text() } }
            val projectCustomers: List<String> = cv.project_experiences.filter { it.disabled != true }
                .mapNotNull { it.customer?.text() }.distinct()
            val employers: List<String> = cv.work_experiences.filter { it.disabled != true }
                .mapNotNull { it.employer?.text() }.distinct()
            val schools: List<String> = cv.educations.filter { it.disabled != true }
                .mapNotNull { it.school?.text() }.distinct()
            getFirestore().collection("consultants").document(consultantId)
                .update(mapOf(
                    "technologies" to techTags,
                    "projectCustomers" to projectCustomers,
                    "employers" to employers,
                    "schools" to schools
                )).get()

            call.respond(ConsultantCVResponse(
                workExperience = cv.work_experiences
                    .filter { it.disabled != true }
                    .sortedWith(compareByDescending<FlowcaseWorkExp> { it.year_from?.toIntOrNull() }.thenByDescending { it.month_from })
                    .map { CVWorkEntry(it.id, it.employer?.text(), (it.long_description ?: it.description)?.text(), it.year_from?.toIntOrNull(), it.month_from, it.year_to?.toIntOrNull(), it.month_to) },
                projectExperience = cv.project_experiences
                    .filter { it.disabled != true }
                    .sortedWith(compareByDescending<FlowcaseProjExp> { it.year_from?.toIntOrNull() }.thenByDescending { it.month_from })
                    .map { CVProjectEntry(it.id, it.customer?.text(), it.roles.filter { r -> r.disabled != true }.mapNotNull { r -> r.name?.text() }, (it.long_description ?: it.description)?.text(), it.year_from?.toIntOrNull(), it.month_from, it.year_to?.toIntOrNull(), it.month_to) },
                education = cv.educations
                    .filter { it.disabled != true }
                    .sortedByDescending { it.year_from?.toIntOrNull() }
                    .map { CVEducationEntry(it.id, it.school?.text(), it.degree?.text(), it.year_from?.toIntOrNull(), it.year_to?.toIntOrNull()) },
                technologies = cv.technologies
                    .filter { it.disabled != true }
                    .sortedBy { it.order }
                    .map { CVTechGroup(it.category?.text(), it.technology_skills.mapNotNull { t -> t.tags?.text() }) }
                    .filter { it.tags.isNotEmpty() },
                keyQualifications = cv.key_qualifications
                    .filter { it.disabled != true }
                    .sortedBy { it.order }
                    .map { CVKeyQual(it.label?.text(), it.long_description?.text()) }
                    .filter { it.description != null || it.label != null }
            ))
        }

        post("/check-contracts") {
            val secret = call.request.headers["X-Scheduler-Secret"]
            val isScheduler = secret != null && secret == config.schedulerSecret
            if (!isScheduler && call.checkFirebaseAdmin() == null) {
                call.respond(HttpStatusCode.Unauthorized, "Invalid scheduler secret or unauthenticated")
                return@post
            }

            val dateParam = call.request.queryParameters["date"]
            val overrideDate = dateParam?.let { param ->
                val parsed = runCatching { java.time.LocalDate.parse(param) }.getOrNull()
                if (parsed == null) {
                    call.respond(HttpStatusCode.BadRequest, "Invalid date format, expected YYYY-MM-DD")
                    return@post
                }
                val today = java.time.LocalDate.now(java.time.ZoneOffset.UTC)
                if (parsed.isBefore(today.minusDays(7)) || parsed.isAfter(today.plusDays(7))) {
                    call.respond(HttpStatusCode.BadRequest, "Date must be within 7 days of today")
                    return@post
                }
                parsed
            }

            val notified = checkAndNotifyContracts(overrideDate, config.appUrl)
            val usedDate = (overrideDate ?: java.time.LocalDate.now(java.time.ZoneOffset.UTC)).toString()
            call.respond(CheckContractsResponse(notified, usedDate))
        }

        post("/test-email") {
            call.authenticateFirebase() ?: return@post

            val body = call.receive<TestEmailRequest>()
            val emailRequest = com.resend.services.emails.model.CreateEmailOptions.builder()
                .from("onboarding@resend.dev")
                .to(listOf(body.to))
                .subject("Test-epost fra Konsulent Admin")
                .html(testEmail())
                .build()
            resendClient.emails().send(emailRequest)
            call.respond(TestEmailResponse(sent = true))
        }
    }
}
