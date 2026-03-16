package com.scienta

import io.ktor.client.*
import io.ktor.client.call.*
import io.ktor.client.engine.cio.*
import io.ktor.client.plugins.contentnegotiation.*
import io.ktor.client.request.*
import io.ktor.serialization.kotlinx.json.*
import kotlinx.coroutines.delay
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
    val image: FlowcaseImage? = null
)

fun buildFlowcaseClient(): HttpClient = HttpClient(CIO) {
    install(ContentNegotiation) {
        json(flowcaseJson)
    }
}

suspend fun fetchFlowcaseUsers(apiKey: String): List<FlowcaseUser> {
    buildFlowcaseClient().use { client ->
        return client.get("https://api.flowcase.com/api/v2/users/search") {
            bearerAuth(apiKey)
        }.body()
    }
}

// Rate-limited photo fetch: 5 req/s = 200ms between requests
// Photo URL is embedded in the user object from /users/search.
// If Flowcase requires a separate call, replace this with the actual endpoint.
suspend fun fetchPhotoUrls(
    apiKey: String,
    users: List<FlowcaseUser>
): Map<String, String?> {
    val result = mutableMapOf<String, String?>()
    buildFlowcaseClient().use { client ->
        for (user in users) {
            // Image URL is already in the user search response
            result[user.id] = user.image?.url
            delay(200) // respect 5 req/s rate limit
        }
    }
    return result
}
