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
        anyHost() // Begrenses til faktisk domene ved produksjon
        allowHeader(HttpHeaders.Authorization)
        allowHeader(HttpHeaders.ContentType)
        allowMethod(HttpMethod.Post)
        allowMethod(HttpMethod.Get)
    }

    configureSerialization()
    configureRouting()
}
