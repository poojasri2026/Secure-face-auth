"""Reusable email service (spec section 33).

If SMTP credentials are configured, OTP emails are sent via SMTP. Otherwise the
OTP is logged to the backend console so local development still works. The OTP
is NEVER returned in an API response.
"""
from __future__ import annotations

import logging
from email.message import EmailMessage
from typing import Tuple

from app.core.config import settings

logger = logging.getLogger("app.email")

_PURPOSE_LABEL = {
    "registration": "verify your email",
    "login": "complete your login",
    "password_reset": "reset your password",
    "email_change": "confirm your new email",
}


def build_otp_email(otp: str, purpose: str) -> Tuple[str, str, str]:
    minutes = settings.OTP_EXPIRE_MINUTES
    action = _PURPOSE_LABEL.get(purpose, "verify your account")
    subject = f"{settings.APP_NAME} verification code: {otp}"
    text = (
        f"Your verification code is:\n\n    {otp}\n\n"
        f"Use it to {action}. This code expires in {minutes} minutes.\n"
        "If you did not request this code, you can safely ignore this email.\n"
    )
    html = f"""\
<div style="font-family:Segoe UI,Arial,sans-serif;max-width:480px;margin:auto">
  <h2 style="color:#0f172a">{settings.APP_NAME}</h2>
  <p>Your verification code is:</p>
  <p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#4f46e5">{otp}</p>
  <p>Use it to {action}. This code expires in <b>{minutes} minutes</b>.</p>
  <p style="color:#64748b;font-size:13px">If you did not request this code, ignore this email.</p>
</div>"""
    return subject, text, html


async def send_email(to_email: str, subject: str, text_body: str, html_body: str) -> None:
    if not settings.smtp_configured:
        # Console fallback for development.
        logger.warning(
            "[EMAIL:CONSOLE-FALLBACK] SMTP not configured. Email to %s\nSubject: %s\n%s",
            to_email, subject, text_body,
        )
        return

    message = EmailMessage()
    message["From"] = settings.SMTP_FROM_EMAIL or settings.SMTP_USERNAME
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(text_body)
    message.add_alternative(html_body, subtype="html")

    import aiosmtplib

    try:
        await aiosmtplib.send(
            message,
            hostname=settings.SMTP_HOST,
            port=settings.SMTP_PORT,
            username=settings.SMTP_USERNAME,
            password=settings.SMTP_PASSWORD,
            start_tls=settings.SMTP_USE_TLS,
            timeout=settings.SMTP_TIMEOUT_SECONDS,
        )
        logger.info("OTP email sent to %s", to_email)
    except Exception as exc:  # pragma: no cover - network dependent
        logger.error("Failed to send email to %s: %s", to_email, exc)
        raise


async def send_otp_email(to_email: str, otp: str, purpose: str) -> None:
    subject, text, html = build_otp_email(otp, purpose)
    await send_email(to_email, subject, text, html)
