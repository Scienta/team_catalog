package com.scienta

import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.plugins.cors.routing.*

fun main(args: Array<String>) {
    io.ktor.server.netty.EngineMain.main(args)
}

fun Application.module() {
    val config = loadConfig()

    initFirebase(config)
    initResend(config)

    install(CORS) {
        val allowedOrigin = System.getenv("ALLOWED_ORIGIN")
        if (allowedOrigin.isNullOrBlank()) {
            anyHost() // Ingen domene satt — tillat alt (kun lokalt/dev)
        } else {
            allowHost(allowedOrigin.removePrefix("https://").removePrefix("http://"), schemes = listOf("https", "http"))
        }
        allowHeader(HttpHeaders.Authorization)
        allowHeader(HttpHeaders.ContentType)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Get)
    }

    configureSerialization()
    configureRouting(config)
}
