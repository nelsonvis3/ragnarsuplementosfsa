import base64
import json
import os
from email.message import MIMEPart
from unittest.mock import patch

from django.core.mail import EmailMultiAlternatives
from django.test import SimpleTestCase

from .email_backend import ResendEmailBackend


class ResendEmailBackendTests(SimpleTestCase):
    @patch.dict(os.environ, {"RESEND_API_KEY": "re_test_only"})
    @patch("store.email_backend.urlopen")
    def test_api_https_recibe_email_html_y_logo_inline(self, mock_urlopen):
        response = mock_urlopen.return_value.__enter__.return_value
        response.status = 200
        message = EmailMultiAlternatives(
            subject="Confirmá tu correo",
            body="Enlace de confirmación",
            from_email="Ragnar <contacto@ragnar.example>",
            to=["comprador@example.test"],
        )
        message.attach_alternative("<img src='cid:ragnar-logo'>", "text/html")
        logo = MIMEPart()
        logo.set_content(b"imagen-de-prueba", maintype="image", subtype="png",
                         disposition="inline", cid="<ragnar-logo>", filename="logo.png")
        message.attach(logo)
        self.assertEqual(ResendEmailBackend().send_messages([message]), 1)
        request = mock_urlopen.call_args.args[0]
        self.assertEqual(request.full_url, "https://api.resend.com/emails")
        self.assertEqual(request.get_header("Authorization"), "Bearer re_test_only")
        data = json.loads(request.data)
        self.assertEqual(data["to"], ["comprador@example.test"])
        self.assertIn("cid:ragnar-logo", data["html"])
        self.assertEqual(data["attachments"][0]["content_id"], "ragnar-logo")
        self.assertEqual(base64.b64decode(data["attachments"][0]["content"]), b"imagen-de-prueba")

    @patch.dict(os.environ, {"RESEND_API_KEY": ""})
    def test_falta_de_api_key_no_se_reporta_como_correo_enviado(self):
        with self.assertRaisesRegex(RuntimeError, "RESEND_API_KEY"):
            ResendEmailBackend().send_messages([
                EmailMultiAlternatives("Test", "Hola", "Ragnar <test@example.test>", ["cliente@example.test"])
            ])
