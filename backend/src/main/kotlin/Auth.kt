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

// Returns uid if the request is from an authenticated admin — no response sent on failure
suspend fun ApplicationCall.checkFirebaseAdmin(): String? {
    val authHeader = request.headers["Authorization"]
    if (authHeader == null || !authHeader.startsWith("Bearer ")) return null
    val token = authHeader.removePrefix("Bearer ").trim()
    val uid = try {
        getFirebaseAuth().verifyIdToken(token).uid
    } catch (_: FirebaseAuthException) {
        return null
    }
    val adminDoc = getFirestore().collection("admins").document(uid).get().get()
    return if (adminDoc.exists()) uid else null
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
