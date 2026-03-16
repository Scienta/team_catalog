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
    val image: FlowcaseImage? = null
)

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
