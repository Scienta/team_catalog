package com.scienta

data class AppConfig(
    val flowcaseApiKey: String,
    val resendApiKey: String,
    val firebaseProjectId: String,
    val firebaseServiceAccountJson: String,
    val schedulerSecret: String
)

fun loadConfig(): AppConfig {
    fun requireEnv(name: String): String =
        System.getenv(name) ?: error("Missing required environment variable: $name")

    return AppConfig(
        flowcaseApiKey = requireEnv("FLOWCASE_API_KEY"),
        resendApiKey = requireEnv("RESEND_API_KEY"),
        firebaseProjectId = requireEnv("FIREBASE_PROJECT_ID"),
        firebaseServiceAccountJson = requireEnv("FIREBASE_SERVICE_ACCOUNT_JSON"),
        schedulerSecret = requireEnv("SCHEDULER_SECRET")
    )
}
