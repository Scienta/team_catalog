package com.scienta

import com.resend.Resend

lateinit var resendClient: Resend

fun initResend(config: AppConfig) {
    resendClient = Resend(config.resendApiKey)
}
