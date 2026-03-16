package com.scienta

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json

private val flowcaseJson = Json { ignoreUnknownKeys = true }

@Serializable
data class FlowcaseImage(
    val url: String? = null
)

@Serializable
data class FlowcaseUser(
    val id: String,
    val name: String,
    val email: String? = null,
    val telephone: String? = null,
    val image: FlowcaseImage? = null,
    val deactivated: Boolean = false
)

// ── CV data classes ──────────────────────────────────────────────────────────

@Serializable
data class FlowcaseLangText(val no: String? = null, val en: String? = null) {
    fun text(): String? = no?.takeIf { it.isNotBlank() } ?: en?.takeIf { it.isNotBlank() }
}

@Serializable
data class FlowcaseCVRef(val id: String)

@Serializable
data class FlowcaseWorkExp(
    val id: String = "",
    val employer: FlowcaseLangText? = null,
    val description: FlowcaseLangText? = null,
    val year_from: Int? = null,
    val month_from: Int? = null,
    val year_to: Int? = null,
    val month_to: Int? = null,
    val order: Int? = null
)

@Serializable
data class FlowcaseProjRole(
    val id: String = "",
    val name: FlowcaseLangText? = null
)

@Serializable
data class FlowcaseProjExp(
    val id: String = "",
    val customer: FlowcaseLangText? = null,
    val description: FlowcaseLangText? = null,
    val long_description: FlowcaseLangText? = null,
    val year_from: Int? = null,
    val month_from: Int? = null,
    val year_to: Int? = null,
    val month_to: Int? = null,
    val roles: List<FlowcaseProjRole> = emptyList(),
    val order: Int? = null
)

@Serializable
data class FlowcaseEdu(
    val id: String = "",
    val school: FlowcaseLangText? = null,
    val degree: FlowcaseLangText? = null,
    val description: FlowcaseLangText? = null,
    val year_from: Int? = null,
    val year_to: Int? = null
)

@Serializable
data class FlowcaseTechTag(val id: String = "", val name: FlowcaseLangText? = null)

@Serializable
data class FlowcaseTechGroup(
    val id: String = "",
    val label: FlowcaseLangText? = null,
    val tags: List<FlowcaseTechTag> = emptyList()
)

@Serializable
data class FlowcaseKQTag(val id: String = "", val name: FlowcaseLangText? = null)

@Serializable
data class FlowcaseKeyQual(
    val id: String = "",
    val label: FlowcaseLangText? = null,
    val tags: List<FlowcaseKQTag> = emptyList()
)

@Serializable
data class FlowcaseCVFull(
    val id: String = "",
    val work_experience: List<FlowcaseWorkExp> = emptyList(),
    val project_experiences: List<FlowcaseProjExp> = emptyList(),
    val education: List<FlowcaseEdu> = emptyList(),
    val key_qualifications: List<FlowcaseKeyQual> = emptyList(),
    val technologies: List<FlowcaseTechGroup> = emptyList()
)

suspend fun fetchConsultantCV(apiKey: String, userId: String): FlowcaseCVFull? {
    buildFlowcaseClient().use { client ->
        val cvRefs: List<FlowcaseCVRef> = try {
            client.get("https://scienta.flowcase.com/api/v1/users/$userId/cvs") {
                bearerAuth(apiKey)
            }.body()
        } catch (e: Exception) {
            return null
        }
        val cvId = cvRefs.firstOrNull()?.id ?: return null
        return try {
            client.get("https://scienta.flowcase.com/api/v1/users/$userId/cvs/$cvId") {
                bearerAuth(apiKey)
            }.body()
        } catch (e: Exception) {
            null
        }
    }
}

fun buildFlowcaseClient(): HttpClient = HttpClient(CIO) {
    install(ContentNegotiation) {
        json(flowcaseJson)
    }
}

suspend fun fetchFlowcaseUsers(apiKey: String): List<FlowcaseUser> {
    buildFlowcaseClient().use { client ->
        return client.get("https://scienta.flowcase.com/api/v2/users/search") {
            bearerAuth(apiKey)
            parameter("limit", 100)
        }.body()
    }
}

// Photo URL is embedded in the user object from /users/search (image.url).
// Uploading photos uses POST /api/v1/users/<id>/image — no separate fetch needed.
fun extractPhotoUrls(users: List<FlowcaseUser>): Map<String, String?> =
    users.associate { it.id to it.image?.url }
