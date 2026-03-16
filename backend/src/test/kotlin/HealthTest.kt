package com.scienta

import io.ktor.client.request.*
import io.ktor.client.statement.*
import io.ktor.http.*
import io.ktor.server.testing.*
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class HealthTest {

    @Test
    fun `GET health returnerer 200 med status ok`() = testApplication {
        application {
            val testConfig = AppConfig(
                flowcaseApiKey = "test",
                resendApiKey = "test",
                firebaseProjectId = "test",
                firebaseServiceAccountJson = "{}",
                schedulerSecret = "test"
            )
            configureSerialization()
            configureRouting(testConfig)
        }
        client.get("/health").apply {
            assertEquals(HttpStatusCode.OK, status)
            assertTrue(bodyAsText().contains("\"status\":\"ok\""))
        }
    }
}
