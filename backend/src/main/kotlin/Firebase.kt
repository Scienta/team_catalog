package com.scienta

import com.google.auth.oauth2.GoogleCredentials
import com.google.firebase.FirebaseApp
import com.google.firebase.FirebaseOptions
import com.google.firebase.auth.FirebaseAuth
import com.google.firebase.cloud.FirestoreClient
import com.google.cloud.firestore.Firestore
import java.io.ByteArrayInputStream

fun initFirebase(config: AppConfig) {
    if (FirebaseApp.getApps().isNotEmpty()) return

    val serviceAccount = ByteArrayInputStream(config.firebaseServiceAccountJson.toByteArray())
    val credentials = GoogleCredentials.fromStream(serviceAccount)

    val options = FirebaseOptions.builder()
        .setCredentials(credentials)
        .setProjectId(config.firebaseProjectId)
        .build()

    FirebaseApp.initializeApp(options)
}

fun getFirestore(): Firestore = FirestoreClient.getFirestore()

fun getFirebaseAuth(): FirebaseAuth = FirebaseAuth.getInstance()
