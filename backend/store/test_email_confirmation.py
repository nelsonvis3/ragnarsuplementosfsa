import re
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from django.contrib.auth import get_user_model
from django.core import mail, signing
from django.core.cache import cache
from django.test import override_settings
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from .email_confirmation import SALT_CONFIRMACION, crear_token_confirmacion
from .models import VerificacionEmail


@override_settings(EMAIL_CONFIRMATION_FRONTEND_URL="https://tienda.example.test", EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class ConfirmacionEmailTests(APITestCase):
    password = "SyntheticRegistro2026!"

    def setUp(self):
        cache.clear()

    def registrar(self, **cambios):
        return self.client.post("/auth/registro", {"nombre_completo": "Cliente de prueba", "email": "nuevo@example.test", "password": self.password, **cambios}, format="json")

    def cuenta_pendiente(self):
        response = self.registrar()
        self.assertEqual(response.status_code, 201, response.data)
        return get_user_model().objects.get(email="nuevo@example.test")

    def confirmar(self, token):
        return self.client.post("/auth/email/confirmar", {"token": token}, format="json")

    def test_registro_envia_bienvenida_y_no_entrega_token_antes_de_confirmar(self):
        response = self.registrar(is_superuser=True, is_staff=True, is_active=True)
        self.assertEqual(response.status_code, 201, response.data)
        self.assertNotIn("token", response.data)
        self.assertTrue(response.data["correo_enviado"])
        user = get_user_model().objects.get(email="nuevo@example.test")
        self.assertFalse(user.is_active or user.is_staff or user.is_superuser)
        self.assertEqual(VerificacionEmail.objects.count(), 1)
        self.assertEqual(len(mail.outbox), 1)
        message = mail.outbox[0]
        self.assertEqual(message.to, [user.email])
        self.assertIn("Bienvenido/a a Ragnar.", message.body)
        self.assertIn("Hace click para desbloquear tu potencial!", message.body)
        html = message.alternatives[0].content
        self.assertIn("Confirmar e-mail", html)
        self.assertIn("#fbbf24", html)
        self.assertIn("#0a0a0a", html)
        self.assertIn('src="cid:ragnar-logo"', html)
        self.assertEqual(message.attachments[0]["Content-ID"], "<ragnar-logo>")
        self.assertEqual(message.attachments[0].get_content_type(), "image/png")
        self.assertEqual(message.attachments[0]["Content-Disposition"].content_disposition, "inline")
        self.assertIn("Confirmar e-mail", message.message().get_body(preferencelist=("html",)).get_content())

    def test_login_y_jwt_no_habilitan_una_cuenta_pendiente(self):
        user = self.cuenta_pendiente()
        response = self.client.post("/auth/login", {"email": user.email, "password": self.password}, format="json")
        self.assertEqual(response.status_code, 403)
        self.assertNotIn("token", response.data)
        with patch("rest_framework_simplejwt.tokens.logger.warning"):
            token = AccessToken.for_user(user)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {token}")
        self.assertEqual(self.client.get("/auth/perfil").status_code, 401)
        self.assertEqual(self.client.get("/administracion/productos/").status_code, 401)

    def test_enlace_usa_origen_configurado_y_no_tiene_token_en_query(self):
        self.client.credentials(HTTP_ORIGIN="https://intruso.example.test")
        user = self.cuenta_pendiente()
        link = urlparse(re.search(r"https://[^\s]+", mail.outbox[0].body).group())
        self.assertEqual(link.netloc, "tienda.example.test")
        self.assertEqual(link.path, "/confirmar-email")
        self.assertEqual(link.query, "")
        token = parse_qs(link.fragment)["token"][0]
        payload = signing.loads(token, salt=SALT_CONFIRMACION)
        self.assertEqual(payload["uid"], user.pk)

    def test_confirmacion_activa_una_vez_y_habilita_login_sin_permisos_admin(self):
        user = self.cuenta_pendiente()
        token = crear_token_confirmacion(user.verificacion_email)
        self.client.credentials(HTTP_AUTHORIZATION="Bearer vencido")
        self.assertEqual(self.confirmar(token).status_code, 200)
        user.refresh_from_db()
        self.assertTrue(user.is_active)
        self.assertIsNotNone(user.verificacion_email.confirmado_en)
        self.assertFalse(user.is_staff or user.is_superuser)
        self.assertEqual(self.confirmar(token).status_code, 400)
        self.client.credentials()
        login = self.client.post("/auth/login", {"email": user.email, "password": self.password}, format="json")
        self.assertEqual(login.status_code, 200, login.data)
        self.assertFalse(login.data["usuario"]["puede_administrar_catalogo"])
        self.assertTrue(login.data["usuario"]["puede_recuperar_contrasena"])

    def test_firma_alterada_y_token_de_otro_proposito_no_activan(self):
        user = self.cuenta_pendiente()
        token = crear_token_confirmacion(user.verificacion_email)
        for invalido in (token + "alterado", signing.dumps({"uid": user.pk}, salt="otro-proposito"), signing.dumps([user.pk], salt=SALT_CONFIRMACION), signing.dumps({"uid": 9223372036854775808}, salt=SALT_CONFIRMACION)):
            self.assertEqual(self.confirmar(invalido).status_code, 400)
        user.refresh_from_db()
        self.assertFalse(user.is_active)

    def test_enlace_vence_despues_de_24_horas_y_puede_reenviarse(self):
        user = self.cuenta_pendiente()
        with patch("django.core.signing.time.time", return_value=1800000000):
            token = crear_token_confirmacion(user.verificacion_email)
        with patch("django.core.signing.time.time", return_value=1800086401):
            self.assertEqual(self.confirmar(token).status_code, 400)
        cache.clear()
        response = self.client.post("/auth/email/reenviar", {"email": user.email.upper()}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 2)
        link = re.search(r"https://[^\s]+", mail.outbox[1].body).group()
        nuevo_token = parse_qs(urlparse(link).fragment)["token"][0]
        self.assertEqual(self.confirmar(nuevo_token).status_code, 200)

    def test_superusuarios_y_staff_no_se_activan_con_enlace_publico(self):
        user = self.cuenta_pendiente()
        token = crear_token_confirmacion(user.verificacion_email)
        for campo in ("is_superuser", "is_staff"):
            setattr(user, campo, True)
            user.save(update_fields=[campo])
            self.assertEqual(self.confirmar(token).status_code, 400)
            setattr(user, campo, False)
            user.save(update_fields=[campo])
        user.refresh_from_db()
        self.assertFalse(user.is_active)

    def test_cambiar_email_invalida_el_enlace_anterior(self):
        user = self.cuenta_pendiente()
        token = crear_token_confirmacion(user.verificacion_email)
        user.email = "otro@example.test"
        user.save(update_fields=["email"])
        self.assertEqual(self.confirmar(token).status_code, 400)

    def test_cuentas_existentes_sin_verificacion_siguen_ingresando(self):
        user = get_user_model().objects.create_user(username="existente", email="existente@example.test", password=self.password)
        response = self.client.post("/auth/login", {"email": user.email, "password": self.password}, format="json")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(VerificacionEmail.objects.exists())

    def test_reenvio_no_revela_usuarios_y_excluye_admin_y_cuentas_confirmadas(self):
        User = get_user_model()
        user = self.cuenta_pendiente()
        User.objects.create_superuser(username="jefe", email="jefe@example.test", password=self.password)
        User.objects.create_user(username="staff", email="staff@example.test", is_staff=True)
        User.objects.create_user(username="existente", email="existente@example.test", password=self.password)
        respuestas = []
        for email in ("desconocido@example.test", "jefe@example.test", "staff@example.test", "existente@example.test", user.email):
            response = self.client.post("/auth/email/reenviar", {"email": email}, format="json")
            self.assertEqual(response.status_code, 200)
            respuestas.append(response.data)
        self.assertTrue(all(respuesta == respuestas[0] for respuesta in respuestas))
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(self.client.post("/auth/email/reenviar", {"email": user.email}, format="json").status_code, 429)

    def test_replay_no_reactiva_una_cuenta_desactivada_despues(self):
        user = self.cuenta_pendiente()
        token = crear_token_confirmacion(user.verificacion_email)
        self.assertEqual(self.confirmar(token).status_code, 200)
        user.is_active = False
        user.save(update_fields=["is_active"])
        self.assertEqual(self.confirmar(token).status_code, 400)
        user.refresh_from_db()
        self.assertFalse(user.is_active)

    def test_otro_registro_no_sobrescribe_password_de_una_cuenta_pendiente(self):
        user = self.cuenta_pendiente()
        self.assertEqual(self.registrar(password="SyntheticDiferente2026!").status_code, 400)
        user.refresh_from_db()
        self.assertTrue(user.check_password(self.password))

    @patch("store.email_confirmation.enviar_bienvenida_registro", side_effect=OSError("Proveedor no disponible"))
    def test_fallo_de_correo_conserva_cuenta_pendiente_y_permite_reintentar(self, enviar):
        with self.assertLogs("store.email_confirmation", level="WARNING") as logs:
            response = self.registrar()
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data["correo_enviado"])
        self.assertFalse(get_user_model().objects.get(email="nuevo@example.test").is_active)
        self.assertNotIn("nuevo@example.test", " ".join(logs.output))
        self.assertEqual(len(mail.outbox), 0)

    def test_nombre_html_se_escapa_en_el_correo(self):
        self.registrar(nombre_completo='<img src=x onerror="alert(1)">')
        html = mail.outbox[0].alternatives[0].content
        self.assertNotIn('<img src=x onerror=', html)
        self.assertIn('&lt;img', html)

    def test_registro_con_backend_de_consola_no_afirma_entrega_real(self):
        with override_settings(EMAIL_BACKEND="django.core.mail.backends.console.EmailBackend"):
            response = self.registrar()
        self.assertEqual(response.status_code, 201)
        self.assertFalse(response.data["correo_enviado"])
        self.assertIn("terminal", response.data["detail"].lower())
