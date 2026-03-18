package com.scienta

private fun String.escapeHtml(): String = this
    .replace("&", "&amp;")
    .replace("<", "&lt;")
    .replace(">", "&gt;")
    .replace("\"", "&quot;")
    .replace("'", "&#39;")

fun contractWarningEmail(
    consultantName: String,
    clientName: String,
    contractEndFormatted: String,
    warningDays: Long,
    appUrl: String
): String {
    val safeName = consultantName.escapeHtml()
    val safeClient = clientName.escapeHtml()
    val logoHtml = if (appUrl.isNotBlank())
        """<img src="$appUrl/scienta-logo.png" alt="Scienta" width="120" style="display:block;margin:0 auto 32px;" />"""
    else
        """<p style="font-size:18px;font-weight:700;color:#111;letter-spacing:-0.5px;text-align:center;margin:0 0 32px;">Scienta</p>"""

    val loginButton = if (appUrl.isNotBlank())
        """<a href="$appUrl" style="display:inline-block;background:#111111;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;padding:12px 28px;border-radius:10px;letter-spacing:0.1px;">Logg inn og se detaljer</a>"""
    else
        """<span style="display:inline-block;background:#111111;color:#ffffff;font-size:14px;font-weight:600;padding:12px 28px;border-radius:10px;">Logg inn og se detaljer</span>"""

    return """
<!DOCTYPE html>
<html lang="no">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>Kontraktsvarsel</title>
</head>
<body style="margin:0;padding:0;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:40px 16px;">
  <tr>
    <td align="center">
      <table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e5e5e5;">

        <!-- Header -->
        <tr>
          <td style="padding:40px 40px 8px;text-align:center;">
            $logoHtml
          </td>
        </tr>

        <!-- Body -->
        <tr>
          <td style="padding:8px 40px 32px;">
            <p style="font-size:22px;font-weight:700;color:#111;letter-spacing:-0.5px;margin:0 0 8px;">Kontraktsvarsel</p>
            <p style="font-size:15px;color:#555;line-height:1.6;margin:0 0 28px;">
              Kontrakten til <strong style="color:#111;">$safeName</strong> hos
              <strong style="color:#111;">$safeClient</strong> utløper om
              <strong style="color:#111;">$warningDays dager</strong>.
            </p>

            <!-- Info card -->
            <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8f8f8;border-radius:10px;border:1px solid #ebebeb;margin-bottom:28px;">
              <tr>
                <td style="padding:20px 24px;">
                  <table width="100%" cellpadding="0" cellspacing="0">
                    <tr>
                      <td style="padding:6px 0;border-bottom:1px solid #ebebeb;">
                        <span style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Konsulent</span><br/>
                        <span style="font-size:14px;font-weight:600;color:#111;">$safeName</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;border-bottom:1px solid #ebebeb;">
                        <span style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Kunde</span><br/>
                        <span style="font-size:14px;font-weight:600;color:#111;">$safeClient</span>
                      </td>
                    </tr>
                    <tr>
                      <td style="padding:6px 0;">
                        <span style="font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.5px;">Utløpsdato</span><br/>
                        <span style="font-size:14px;font-weight:600;color:#111;">$contractEndFormatted</span>
                      </td>
                    </tr>
                  </table>
                </td>
              </tr>
            </table>

            <table cellpadding="0" cellspacing="0">
              <tr>
                <td>$loginButton</td>
              </tr>
            </table>
          </td>
        </tr>

        <!-- Footer -->
        <tr>
          <td style="padding:20px 40px;border-top:1px solid #ebebeb;background:#fafafa;">
            <p style="font-size:12px;color:#aaa;margin:0;line-height:1.6;">
              Du mottar denne e-posten fordi du er satt opp som varslingskontakt i Scienta Konsulent Admin.
            </p>
          </td>
        </tr>

      </table>
    </td>
  </tr>
</table>
</body>
</html>
    """.trimIndent()
}

fun testEmail(): String = """
<!DOCTYPE html>
<html lang="no">
<head><meta charset="UTF-8" /><title>Test-epost</title></head>
<body style="margin:0;padding:40px 16px;background:#f5f5f5;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;border:1px solid #e5e5e5;overflow:hidden;">
  <tr><td style="padding:40px;">
    <p style="font-size:20px;font-weight:700;color:#111;margin:0 0 12px;">Resend-integrasjonen fungerer!</p>
    <p style="font-size:14px;color:#555;line-height:1.6;margin:0;">Denne e-posten ble sendt fra Scienta Konsulent Admin som en test. Alt ser bra ut.</p>
  </td></tr>
  <tr><td style="padding:16px 40px;border-top:1px solid #ebebeb;background:#fafafa;">
    <p style="font-size:12px;color:#aaa;margin:0;">Scienta Konsulent Admin — dev-verktøy</p>
  </td></tr>
</table>
</body>
</html>
""".trimIndent()
