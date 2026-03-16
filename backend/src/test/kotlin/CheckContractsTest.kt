package com.scienta

import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.server.testing.*
import kotlin.test.Test
import kotlin.test.assertEquals

class CheckContractsTest {

    private val testConfig = AppConfig(
        flowcaseApiKey = "test",
        resendApiKey = "test",
        firebaseProjectId = "test",
        firebaseServiceAccountJson = "{}",
        schedulerSecret = "supersecret"
    )

    @Test
    fun `manglende X-Scheduler-Secret gir 401`() = testApplication {
        application {
            configureSerialization()
            configureRouting(testConfig)
        }
        client.post("/check-contracts").apply {
            assertEquals(HttpStatusCode.Unauthorized, status)
        }
    }

    @Test
    fun `feil X-Scheduler-Secret gir 401`() = testApplication {
        application {
            configureSerialization()
            configureRouting(testConfig)
        }
        client.post("/check-contracts") {
            header("X-Scheduler-Secret", "feil-secret")
        }.apply {
            assertEquals(HttpStatusCode.Unauthorized, status)
        }
    }
}
