from unittest.mock import patch

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase

from .models import SolicitudAtencion


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend", ATENCION_EMAIL="adansiv16@gmail.com")
class CorreoAsesoramientoTests(APITestCase):
    datos = {"tipo": "consulta", "nombre": "Cliente de prueba", "email": "cliente@example.test", "mensaje": "Quiero consultar por un producto."}

    def setUp(self):
        cache.clear()

    def test_consulta_se_guarda_y_notifica_al_destinatario_con_reply_to_del_cliente(self):
        response = self.client.post("/atencion/solicitudes", self.datos, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertTrue(SolicitudAtencion.objects.filter(pk=response.data["id"]).exists())
        self.assertEqual(len(mail.outbox), 1)
        correo = mail.outbox[0]
        self.assertEqual(correo.to, ["adansiv16@gmail.com"])
        self.assertEqual(correo.from_email, settings.DEFAULT_FROM_EMAIL)
        self.assertEqual(correo.reply_to, [self.datos["email"]])
        self.assertIn(self.datos["mensaje"], correo.body)
        self.assertIn(f'#{response.data["id"]}', correo.subject)

    @patch("store.emails.EmailMultiAlternatives.send", side_effect=OSError("SMTP caído"))
    def test_fallo_smtp_no_pierde_consulta_ni_devuelve_error_al_cliente(self, enviar):
        with self.assertLogs("store.views", level="WARNING"):
            response = self.client.post("/atencion/solicitudes", self.datos, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(SolicitudAtencion.objects.count(), 1)
        enviar.assert_called_once()

    def test_datos_invalidos_no_generan_correo(self):
        for datos in ({**self.datos, "email": "invalido"}, {**self.datos, "mensaje": ""}):
            self.assertEqual(self.client.post("/atencion/solicitudes", datos, format="json").status_code, 400)
        self.assertFalse(SolicitudAtencion.objects.exists())
        self.assertEqual(len(mail.outbox), 0)

    def test_limiter_tambien_protege_a_usuarios_autenticados(self):
        user = get_user_model().objects.create_user(username="cliente", email="cliente@example.test")
        self.client.force_authenticate(user)
        for _ in range(10):
            self.assertEqual(self.client.post("/atencion/solicitudes", self.datos, format="json").status_code, 201)
        self.assertEqual(self.client.post("/atencion/solicitudes", self.datos, format="json").status_code, 429)
        self.assertEqual(len(mail.outbox), 10)

    def test_reclamos_no_se_envian_al_buzon_de_asesoramiento(self):
        response = self.client.post("/atencion/solicitudes", {**self.datos, "tipo": "reclamo"}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(len(mail.outbox), 0)
