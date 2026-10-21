"""Adaptador de Django al envío de emails transaccionales de Resend vía HTTPS.

Render Free restringe el SMTP saliente; su API HTTPS en el puerto 443 es compatible.
Requiere EMAIL_BACKEND=store.email_backend.ResendEmailBackend, RESEND_API_KEY
y DEFAULT_FROM_EMAIL con un remitente verificado por Resend.
"""
import base64
import json
import logging
import os
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from django.core.mail.backends.base import BaseEmailBackend

logger = logging.getLogger(__name__)


class ResendEmailBackend(BaseEmailBackend):
    API_URL = "https://api.resend.com/emails"

    def send_messages(self, email_messages):
        if not email_messages:
            return 0
        api_key = os.environ.get("RESEND_API_KEY", "").strip()
        if not api_key:
            if self.fail_silently:
                logger.warning("Resend: falta configurar RESEND_API_KEY.")
                return 0
            raise RuntimeError("Falta RESEND_API_KEY para enviar correos desde Ragnar.")
        enviados = 0
        for message in email_messages:
            if not message.recipients():
                continue
            try:
                datos = {
                    "from": message.from_email,
                    "to": list(message.to),
                    "subject": message.subject,
                    "text": message.body,
                }
                if message.cc:
                    datos["cc"] = list(message.cc)
                if message.bcc:
                    datos["bcc"] = list(message.bcc)
                for alternativa in getattr(message, "alternatives", []):
                    if alternativa.mimetype == "text/html":
                        datos["html"] = alternativa.content
                        break
                adjuntos = []
                for attachment in message.attachments:
                    if hasattr(attachment, "get_payload"):
                        content = attachment.get_payload(decode=True)
                        filename = attachment.get_filename() or "archivo"
                        content_id = attachment.get("Content-ID", "").strip("<>")
                        content_type = attachment.get_content_type()
                    else:
                        filename, content, content_type = attachment
                        if isinstance(content, str):
                            content = content.encode("utf-8")
                        content_id = ""
                    if content is None:
                        continue
                    adjunto = {
                        "filename": filename,
                        "content": base64.b64encode(content).decode("ascii"),
                        "content_type": content_type or "application/octet-stream",
                    }
                    if content_id:
                        adjunto["content_id"] = content_id
                    adjuntos.append(adjunto)
                if adjuntos:
                    datos["attachments"] = adjuntos
                request = Request(
                    self.API_URL,
                    data=json.dumps(datos).encode("utf-8"),
                    headers={
                        "Authorization": f"Bearer {api_key}",
                        "Content-Type": "application/json",
                    },
                    method="POST",
                )
                with urlopen(request, timeout=15) as response:
                    if response.status < 200 or response.status >= 300:
                        raise RuntimeError("Resend no aceptó el envío.")
                enviados += 1
            except HTTPError as exc:
                logger.warning("Resend rechazó el correo (HTTP %s).", exc.code)
                if not self.fail_silently:
                    raise RuntimeError(
                        f"Resend rechazó el correo (HTTP {exc.code}). Verificá el dominio y el remitente."
                    ) from exc
            except (URLError, OSError, RuntimeError) as exc:
                logger.warning("No se pudo completar el envío mediante Resend.")
                if not self.fail_silently:
                    raise RuntimeError("No se pudo conectar o enviar el correo mediante Resend.") from exc
        return enviados
