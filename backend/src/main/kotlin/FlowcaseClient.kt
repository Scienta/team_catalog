package com.scienta

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.serialization.SerialName
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
    val deactivated: Boolean = false,
    val default_cv_id: String? = null
)

// ── CV data classes (Flowcase API v3) ────────────────────────────────────────

// Multi-language text: Flowcase uses "no" for Norwegian, "int" for English
@Serializable
data class FlowcaseLangText(val no: String? = null, val int: String? = null) {
    fun text(): String? = no?.takeIf { it.isNotBlank() } ?: int?.takeIf { it.isNotBlank() }
}

@Serializable
data class FlowcaseWorkExp(
    @SerialName("_id") val id: String = "",
    val employer: FlowcaseLangText? = null,
    val long_description: FlowcaseLangText? = null,
    val description: FlowcaseLangText? = null,
    val year_from: String? = null,
    val month_from: Int? = null,
    val year_to: String? = null,
    val month_to: Int? = null,
    val order: Int? = null,
    val disabled: Boolean? = false
)

@Serializable
data class FlowcaseProjRole(
    @SerialName("_id") val id: String = "",
    val name: FlowcaseLangText? = null,
    val long_description: FlowcaseLangText? = null,
    val disabled: Boolean? = false
)

@Serializable
data class FlowcaseProjExp(
    @SerialName("_id") val id: String = "",
    val customer: FlowcaseLangText? = null,
    val long_description: FlowcaseLangText? = null,
    val description: FlowcaseLangText? = null,
    val year_from: String? = null,
    val month_from: Int? = null,
    val year_to: String? = null,
    val month_to: Int? = null,
    val roles: List<FlowcaseProjRole> = emptyList(),
    val order: Int? = null,
    val disabled: Boolean? = false
)

@Serializable
data class FlowcaseEdu(
    @SerialName("_id") val id: String = "",
    val school: FlowcaseLangText? = null,
    val degree: FlowcaseLangText? = null,
    val year_from: String? = null,
    val year_to: String? = null,
    val order: Int? = null,
    val disabled: Boolean? = false
)

@Serializable
data class FlowcaseTechSkill(
    val tags: FlowcaseLangText? = null,
    val order: Int? = null
)

@Serializable
data class FlowcaseTechGroup(
    @SerialName("_id") val id: String = "",
    val category: FlowcaseLangText? = null,
    val technology_skills: List<FlowcaseTechSkill> = emptyList(),
    val order: Int? = null,
    val disabled: Boolean? = false
)

@Serializable
data class FlowcaseKeyQual(
    @SerialName("_id") val id: String = "",
    val label: FlowcaseLangText? = null,
    val long_description: FlowcaseLangText? = null,
    val order: Int? = null,
    val disabled: Boolean? = false
)

@Serializable
data class FlowcaseCVFull(
    val work_experiences: List<FlowcaseWorkExp> = emptyList(),
    val project_experiences: List<FlowcaseProjExp> = emptyList(),
    val educations: List<FlowcaseEdu> = emptyList(),
    val key_qualifications: List<FlowcaseKeyQual> = emptyList(),
    val technologies: List<FlowcaseTechGroup> = emptyList()
)

suspend fun fetchConsultantCV(apiKey: String, userId: String, defaultCvId: String?): FlowcaseCVFull? {
    if (defaultCvId.isNullOrBlank()) return null
    return buildFlowcaseClient().use { client ->
        fetchConsultantCVWithClient(client, apiKey, userId, defaultCvId)
    }
}

suspend fun fetchConsultantCVWithClient(client: HttpClient, apiKey: String, userId: String, cvId: String): FlowcaseCVFull? {
    return try {
        client.get("https://scienta.flowcase.com/api/v3/cvs/$userId/$cvId") {
            bearerAuth(apiKey)
        }.body()
    } catch (e: Exception) {
        null
    }
}

fun buildFlowcaseClient(): HttpClient = HttpClient(CIO) {
    install(ContentNegotiation) {
        json(flowcaseJson)
    }
}

suspend fun fetchFlowcaseUsers(apiKey: String): List<FlowcaseUser> {
    val pageSize = 100
    val allUsers = mutableListOf<FlowcaseUser>()
    var offset = 0
    buildFlowcaseClient().use { client ->
        while (true) {
            val page: List<FlowcaseUser> = client.get("https://scienta.flowcase.com/api/v2/users/search") {
                bearerAuth(apiKey)
                parameter("limit", pageSize)
                parameter("offset", offset)
            }.body()
            allUsers.addAll(page)
            if (page.size < pageSize) break
            offset += pageSize
        }
    }
    return allUsers
}

// Photo URL is embedded in the user object from /users/search (image.url).
fun extractPhotoUrls(users: List<FlowcaseUser>): Map<String, String?> =
    users.associate { it.id to it.image?.url }
