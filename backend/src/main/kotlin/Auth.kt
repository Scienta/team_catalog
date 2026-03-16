package com.scienta

import com.google.firebase.auth.FirebaseAuthException
import io.ktor.http.*
import io.ktor.server.application.*
import io.ktor.server.response.*

// Verifies token and returns uid — does NOT check admin status
suspend fun ApplicationCall.verifyFirebaseToken(): String? {
    val authHeader = request.headers["Authorization"]
    if (authHeader == null || !authHeader.startsWith("Bearer ")) {
        respond(HttpStatusCode.Unauthorized, "Missing or invalid Authorization header")
        return null
    }
    val token = authHeader.removePrefix("Bearer ").trim()
    return try {
        getFirebaseAuth().verifyIdToken(token).uid
    } catch (e: FirebaseAuthException) {
        respond(HttpStatusCode.Unauthorized, "Invalid token")
        null
    }
}

suspend fun ApplicationCall.authenticateFirebase(): String? {
    val authHeader = request.headers["Authorization"]
    if (authHeader == null || !authHeader.startsWith("Bearer ")) {
        respond(HttpStatusCode.Unauthorized, "Missing or invalid Authorization header")
        return null
    }

    val token = authHeader.removePrefix("Bearer ").trim()

    val uid = try {
        val decodedToken = getFirebaseAuth().verifyIdToken(token)
        decodedToken.uid
    } catch (e: FirebaseAuthException) {
        respond(HttpStatusCode.Unauthorized, "Invalid token")
        return null
    }

    val adminDoc = getFirestore().collection("admins").document(uid).get().get()
    if (!adminDoc.exists()) {
        respond(HttpStatusCode.Unauthorized, "User is not an admin")
        return null
    }

    return uid
}
