import re
from datetime import datetime, timedelta
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse

from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.core import mail
from django.core.cache import cache
from django.test import override_settings
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_encode
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken


@override_settings(PASSWORD_RESET_FRONTEND_URL="https://tienda.example.test", EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class RecuperacionContrasenaTests(APITestCase):
    solicitar_url = "/auth/contrasena/recuperar"
    restablecer_url = "/auth/contrasena/restablecer"
    password_original = "SyntheticOriginal2026!"
    password_nueva = "SyntheticRenovada2026!"

    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.cliente = User.objects.create_user(username="cliente", email="cliente@example.test", password=cls.password_original)
        cls.admin = User.objects.create_superuser(username="jefe", email="jefe@example.test", password=cls.password_original)
        cls.staff = User.objects.create_user(username="staff", email="staff@example.test", password=cls.password_original, is_staff=True)
        cls.inactivo = User.objects.create_user(username="inactivo", email="inactivo@example.test", password=cls.password_original, is_active=False)
        cls.sin_password = User.objects.create_user(username="externo", email="externo@example.test")

    def setUp(self):
        cache.clear()

    def solicitar(self, email=None):
        return self.client.post(self.solicitar_url, {"email": email or self.cliente.email}, format="json")

    def datos(self, user=None, **cambios):
        user = user or self.cliente
        return {"uid": urlsafe_base64_encode(force_bytes(user.pk)), "token": default_token_generator.make_token(user), "password": self.password_nueva, "password_confirmacion": self.password_nueva, **cambios}

    def restablecer(self, datos):
        return self.client.post(self.restablecer_url, datos, format="json")

    def test_cliente_recibe_correo_con_enlace_al_frontend_configurado(self):
        self.client.credentials(HTTP_ORIGIN="https://intruso.example.test", HTTP_AUTHORIZATION="Bearer vencido")
        response = self.solicitar("CLIENTE@example.test")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(mail.outbox[0].to, [self.cliente.email])
        enlace = urlparse(re.search(r"https://[^\s]+", mail.outbox[0].body).group())
        self.assertEqual(enlace.scheme, "https")
        self.assertEqual(enlace.netloc, "tienda.example.test")
        self.assertEqual(enlace.path, "/restablecer-contrasena")
        self.assertEqual(enlace.query, "")
        fragmento = parse_qs(enlace.fragment)
        self.assertTrue(default_token_generator.check_token(self.cliente, fragmento["token"][0]))
        self.assertEqual(fragmento["uid"][0], urlsafe_base64_encode(force_bytes(self.cliente.pk)))
        self.assertEqual(mail.outbox[0].alternatives[0].mimetype, "text/html")

    def test_cuentas_excluidas_y_desconocidas_reciben_respuesta_identica_sin_correo(self):
        respuestas = []
        for email in (self.admin.email, self.staff.email, self.inactivo.email, self.sin_password.email, "desconocido@example.test"):
            cache.clear()
            with self.subTest(email=email):
                response = self.solicitar(email)
                self.assertEqual(response.status_code, 200)
                respuestas.append(response.data)
                self.assertEqual(len(mail.outbox), 0)
        self.assertTrue(all(respuesta == respuestas[0] for respuesta in respuestas))
        cache.clear()
        self.assertEqual(self.solicitar().data, respuestas[0])

    def test_correo_duplicado_no_restablece_la_cuenta_equivocada(self):
        get_user_model().objects.create_user(username="duplicado", email=self.cliente.email, password=self.password_original)
        self.assertEqual(self.solicitar().status_code, 200)
        self.assertEqual(len(mail.outbox), 0)

    def test_repeticion_del_correo_y_limite_por_ip(self):
        response = self.solicitar()
        self.assertEqual(self.solicitar().data, response.data)
        self.assertEqual(len(mail.outbox), 1)
        for numero in range(3):
            self.assertEqual(self.solicitar(f"desconocido{numero}@example.test").status_code, 200)
        self.assertEqual(self.solicitar("otro@example.test").status_code, 429)

    def test_email_invalido(self):
        self.assertEqual(self.solicitar("sin-arroba").status_code, 400)
        self.assertEqual(len(mail.outbox), 0)

    def test_cambio_de_password_invalida_enlace_y_sesiones_anteriores(self):
        sesion_anterior = str(AccessToken.for_user(self.cliente))
        datos = self.datos()
        self.assertEqual(self.restablecer(datos).status_code, 200)
        self.cliente.refresh_from_db()
        self.assertTrue(self.cliente.check_password(self.password_nueva))
        self.assertEqual(self.restablecer(datos).status_code, 400)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {sesion_anterior}")
        self.assertEqual(self.client.get("/auth/perfil").status_code, 401)
        self.client.credentials()
        self.assertEqual(self.client.post("/auth/login", {"email": self.cliente.email, "password": self.password_original}, format="json").status_code, 401)
        login = self.client.post("/auth/login", {"email": self.cliente.email, "password": self.password_nueva}, format="json")
        self.assertEqual(login.status_code, 200)
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {login.data['token']}")
        self.assertEqual(self.client.get("/auth/perfil").status_code, 200)

    def test_admin_y_staff_no_pueden_usar_ni_un_token_firmado_valido(self):
        for user in (self.admin, self.staff, self.inactivo):
            with self.subTest(user=user.username):
                self.assertEqual(self.restablecer(self.datos(user)).status_code, 400)
                user.refresh_from_db()
                self.assertTrue(user.check_password(self.password_original))

    def test_cliente_promovido_a_administrador_no_puede_consumir_su_enlace(self):
        datos = self.datos()
        self.cliente.is_superuser = True
        self.cliente.save(update_fields=["is_superuser"])
        self.assertEqual(self.restablecer(datos).status_code, 400)
        self.cliente.refresh_from_db()
        self.assertTrue(self.cliente.check_password(self.password_original))

    def test_enlace_vence_despues_de_una_hora(self):
        ahora = datetime(2026, 10, 11, 12, 0)
        with patch.object(default_token_generator, "_now", return_value=ahora):
            datos = self.datos()
        with patch.object(default_token_generator, "_now", return_value=ahora + timedelta(hours=1, seconds=1)):
            self.assertEqual(self.restablecer(datos).status_code, 400)

    def test_uid_o_token_alterados_no_cambian_password(self):
        datos = self.datos()
        for cambios in ({"uid": "invalido!"}, {"uid": urlsafe_base64_encode(b"9223372036854775808")}, {"uid": urlsafe_base64_encode(force_bytes(self.staff.pk))}, {"token": datos["token"] + "alterado"}):
            with self.subTest(cambios=cambios):
                self.assertEqual(self.restablecer({**datos, **cambios}).status_code, 400)
        self.cliente.refresh_from_db()
        self.assertTrue(self.cliente.check_password(self.password_original))

    def test_passwords_distintas_o_debiles_conservan_el_enlace_para_reintentar(self):
        datos = self.datos()
        self.assertEqual(self.restablecer({**datos, "password_confirmacion": "Diferente2026!"}).status_code, 400)
        for password in ("corta", "123456789", "password"):
            with self.subTest(password=password):
                self.assertEqual(self.restablecer({**datos, "password": password, "password_confirmacion": password}).status_code, 400)
        self.assertEqual(self.restablecer(datos).status_code, 200)

    def test_cambiar_email_invalida_el_enlace_emitido(self):
        datos = self.datos()
        self.cliente.email = "nuevo@example.test"
        self.cliente.save(update_fields=["email"])
        self.assertEqual(self.restablecer(datos).status_code, 400)

    @patch("store.password_reset.enviar_recuperacion_contrasena", side_effect=OSError("Proveedor no disponible"))
    def test_fallo_del_proveedor_no_revela_la_cuenta_ni_cambia_password(self, enviar):
        with self.assertLogs("store.password_reset", level="WARNING") as logs:
            response = self.solicitar()
        self.assertEqual(response.status_code, 200)
        self.assertNotIn(self.cliente.email, " ".join(logs.output))
        self.cliente.refresh_from_db()
        self.assertTrue(self.cliente.check_password(self.password_original))
        self.assertEqual(len(mail.outbox), 0)
