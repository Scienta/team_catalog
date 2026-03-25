package com.scienta

data class AppConfig(
    val flowcaseApiKey: String,
    val resendApiKey: String,
    val firebaseProjectId: String,
    val firebaseServiceAccountJson: String,
    val schedulerSecret: String,
    val appUrl: String = "",
    val emailFrom: String = "onboarding@resend.dev",
    val publicApiKey: String = "",
    val firebaseApiKey: String = "",
    val firebaseAuthDomain: String = "",
    val firebaseMessagingSenderId: String = "",
    val firebaseAppId: String = ""
)

fun loadConfig(): AppConfig {
    fun requireEnv(name: String): String =
        System.getenv(name) ?: error("Missing required environment variable: $name")

    return AppConfig(
        flowcaseApiKey = requireEnv("FLOWCASE_API_KEY"),
        resendApiKey = requireEnv("RESEND_API_KEY"),
        firebaseProjectId = requireEnv("FIREBASE_PROJECT_ID"),
        firebaseServiceAccountJson = requireEnv("FIREBASE_SERVICE_ACCOUNT_JSON"),
        schedulerSecret = requireEnv("SCHEDULER_SECRET"),
        appUrl = System.getenv("APP_URL") ?: "",
        emailFrom = System.getenv("EMAIL_FROM") ?: "onboarding@resend.dev",
        publicApiKey = System.getenv("PUBLIC_API_KEY") ?: "",
        firebaseApiKey = System.getenv("FIREBASE_API_KEY") ?: "",
        firebaseAuthDomain = System.getenv("FIREBASE_AUTH_DOMAIN") ?: "",
        firebaseMessagingSenderId = System.getenv("FIREBASE_MESSAGING_SENDER_ID") ?: "",
        firebaseAppId = System.getenv("FIREBASE_APP_ID") ?: ""
    )
}
