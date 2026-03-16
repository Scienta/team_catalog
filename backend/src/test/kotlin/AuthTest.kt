package com.scienta

import io.ktor.client.request.*
import io.ktor.http.*
import io.ktor.server.response.*
import io.ktor.server.routing.*
import io.ktor.server.testing.*
import kotlin.test.Test
import kotlin.test.assertEquals

class AuthTest {

    private fun ApplicationTestBuilder.setupTestApp() {
        application {
            routing {
                get("/protected") {
                    val uid = call.authenticateFirebase() ?: return@get
                    call.respondText("OK uid=$uid")
                }
            }
        }
    }

    @Test
    fun `manglende Authorization header gir 401`() = testApplication {
        setupTestApp()
        client.get("/protected").apply {
            assertEquals(HttpStatusCode.Unauthorized, status)
        }
    }

    @Test
    fun `Authorization header uten Bearer prefix gir 401`() = testApplication {
        setupTestApp()
        client.get("/protected") {
            header(HttpHeaders.Authorization, "Basic sometoken")
        }.apply {
            assertEquals(HttpStatusCode.Unauthorized, status)
        }
    }
}
