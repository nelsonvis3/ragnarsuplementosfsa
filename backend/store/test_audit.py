import os
from concurrent.futures import ThreadPoolExecutor
from decimal import Decimal
from threading import Barrier
from unittest.mock import patch
from uuid import uuid4

from django.contrib import admin
from django.contrib.auth import get_user_model
from django.core import mail
from django.core.cache import cache
from django.db import close_old_connections, connection
from django.test import RequestFactory, TransactionTestCase, override_settings
from rest_framework.test import APIClient, APITestCase

from .models import Categoria, Combo, ItemPedido, Pedido, Producto
from .orders import procesar_pedido_manual
from .shipping import ErrorCotizacionEnvio, _distancia_ruta_metros, tarifas_envio
from .views import procesar_notificacion_pago


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class AuditoriaTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = get_user_model().objects.create_superuser("audit-admin", "admin@example.test", "SyntheticAuditPassword2026!")
        cls.cliente = get_user_model().objects.create_user("cliente", "cliente@example.test", "SyntheticAuditPassword2026!")
        cls.productos = [Producto.objects.create(nombre=f"Producto {i}", slug=f"producto-{i}", categoria="creatinas", precio=1000, stock=50, imagen="/logo.png") for i in range(6)]
        cls.combo = Combo.objects.create(nombre="Combo", slug="combo", precio=1800, imagen="/logo.png")
        cls.combo.productos.set(cls.productos[:2])

    def setUp(self):
        cache.clear()

    def pedido(self, estado="aprobado", producto=None, cantidad=1, componentes=None):
        pedido = Pedido.objects.create(nombre_comprador="Prueba", email_comprador="cliente@example.test", telefono_comprador="123", total=1000, estado=estado, proveedor_pago="local")
        ItemPedido.objects.create(pedido=pedido, producto=producto, cantidad=cantidad, precio_unitario=1000, nombre="Prueba", componentes_combo=componentes or [])
        return pedido

    def checkout(self, key=None, items=None):
        return {"checkout_key": str(key or uuid4()), "items": items or [{"tipo": "producto", "id": self.productos[0].pk, "cantidad": 2}], "nombre_comprador": "Prueba", "telefono_comprador": "123", "email_comprador": self.cliente.email, "medio_pago": "local"}

    def test_categoria_creada_se_puede_asignar_y_filtrar(self):
        self.client.force_authenticate(self.admin)
        respuesta = self.client.post("/administracion/categorias/", {"nombre": "Ácidos grasos"}, format="json")
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(respuesta.data["slug"], "acidos-grasos")
        producto = self.productos[0]
        self.assertEqual(self.client.patch(f"/administracion/productos/{producto.pk}/", {"categoria": respuesta.data["slug"]}, format="json").status_code, 200)
        self.client.force_authenticate(None)
        self.assertIn(respuesta.data, self.client.get("/categorias/").data)
        self.assertEqual([p["id"] for p in self.client.get("/productos/?categoria=acidos-grasos").data], [producto.pk])

    def test_categorias_requieren_superusuario_y_rechazan_duplicados(self):
        for usuario, esperado in ((None, 401), (self.cliente, 403)):
            self.client.force_authenticate(usuario)
            self.assertEqual(self.client.post("/administracion/categorias/", {"nombre": "Vitaminas"}, format="json").status_code, esperado)
        self.client.force_authenticate(self.admin)
        self.assertEqual(self.client.post("/administracion/categorias/", {"nombre": "Vitaminas"}, format="json").status_code, 201)
        for nombre in ("VITAMINAS", "Vítaminas", "todos", "Combos", "!!!", " "):
            self.assertEqual(self.client.post("/administracion/categorias/", {"nombre": nombre}, format="json").status_code, 400, nombre)
        self.assertEqual(self.client.patch(f"/administracion/productos/{self.productos[0].pk}/", {"categoria": "inexistente"}, format="json").status_code, 400)

    def test_renombrar_categoria_conserva_slug_y_solo_se_borra_vacia(self):
        self.client.force_authenticate(self.admin)
        creatinas = Categoria.objects.create(nombre="creatinas", slug="creatinas")
        Categoria.objects.create(nombre="Vitaminas", slug="vitaminas")
        respuesta = self.client.patch(f"/administracion/categorias/{creatinas.pk}/", {"nombre": "Creatinas"}, format="json")
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual((respuesta.data["nombre"], respuesta.data["slug"]), ("Creatinas", "creatinas"))
        self.assertEqual(self.client.patch(f"/administracion/categorias/{creatinas.pk}/", {"nombre": "vitaminas"}, format="json").status_code, 400)
        # Tiene productos (los del setUp usan el slug "creatinas"): no se borra.
        self.assertEqual(self.client.delete(f"/administracion/categorias/{creatinas.pk}/").status_code, 409)
        portada = Categoria.objects.create(nombre="proteinas", slug="proteinas")
        self.assertEqual(self.client.delete(f"/administracion/categorias/{portada.pk}/").status_code, 409)
        vacia = Categoria.objects.create(nombre="Sin uso", slug="sin-uso")
        self.assertEqual(self.client.delete(f"/administracion/categorias/{vacia.pk}/").status_code, 204)
        self.client.force_authenticate(self.cliente)
        self.assertEqual(self.client.patch(f"/administracion/categorias/{creatinas.pk}/", {"nombre": "X"}, format="json").status_code, 403)

    def test_destacados_suman_unidades_y_excluyen_estados_no_confirmados(self):
        self.pedido(producto=self.productos[1], cantidad=2)
        self.pedido(producto=self.productos[1], cantidad=3)
        self.pedido(producto=self.productos[2], cantidad=4)
        for estado in ("pendiente", "cancelado", "reembolsado", "rechazado", "contracargo", "revisar_stock", "revision_pago"):
            self.pedido(estado=estado, producto=self.productos[0], cantidad=100)
        ids = [p["id"] for p in self.client.get("/productos/destacados/").data]
        self.assertEqual(ids, [self.productos[i].pk for i in (1, 2, 0, 3)])

    def test_ranking_usa_snapshot_combo_y_cambia_tras_reembolso(self):
        venta = self.pedido(componentes=[self.productos[4].pk, self.productos[5].pk], cantidad=8)
        venta.items.update(combo=self.combo)
        self.combo.productos.set(self.productos[:1])
        ids = [p["id"] for p in self.client.get("/productos/destacados/").data]
        self.assertEqual(ids[:2], [self.productos[4].pk, self.productos[5].pk])
        venta.estado = "reembolsado"
        venta.save()
        self.productos[0].activo = False
        self.productos[0].save()
        self.assertEqual([p["id"] for p in self.client.get("/productos/destacados/").data], [p.pk for p in self.productos[1:5]])

    def test_checkout_idempotente_y_confirmacion_cambian_ranking_una_vez(self):
        self.client.force_authenticate(self.cliente)
        datos = self.checkout(items=[{"tipo": "producto", "id": self.productos[3].pk, "cantidad": 3}])
        primera = self.client.post("/pagos/crear-preferencia", datos, format="json")
        segunda = self.client.post("/pagos/crear-preferencia", datos, format="json")
        self.assertEqual(primera.status_code, 201, primera.data)
        self.assertEqual(segunda.data["pedido_id"], primera.data["pedido_id"])
        self.productos[3].refresh_from_db()
        self.assertEqual(self.productos[3].stock, 47)
        self.assertTrue(procesar_pedido_manual(primera.data["pedido_id"], "aprobar")[0])
        self.assertFalse(procesar_pedido_manual(primera.data["pedido_id"], "aprobar")[0])
        self.assertEqual(self.client.get("/productos/destacados/").data[0]["id"], self.productos[3].pk)

    def test_stock_compartido_falla_sin_dejar_pedido_parcial(self):
        self.productos[0].stock = 2
        self.productos[0].save()
        self.client.force_authenticate(self.cliente)
        datos = self.checkout(items=[{"tipo": "producto", "id": self.productos[0].pk, "cantidad": 2}, {"tipo": "combo", "id": self.combo.pk, "cantidad": 1}])
        self.assertEqual(self.client.post("/pagos/crear-preferencia", datos, format="json").status_code, 400)
        self.assertFalse(Pedido.objects.exists())
        self.productos[0].refresh_from_db()
        self.assertEqual(self.productos[0].stock, 2)

    def test_admin_conserva_pedidos_e_inventario_historico(self):
        request = RequestFactory().get("/admin/")
        request.user = self.admin
        for model in (Pedido, Producto, Combo):
            self.assertFalse(admin.site._registry[model].has_delete_permission(request))
        self.assertFalse(admin.site._registry[Pedido].has_add_permission(request))
        protegidos = admin.site._registry[Pedido].get_readonly_fields(request)
        for campo in ("proveedor_pago", "usuario", "checkout_key", "checkout_payload_hash"):
            self.assertIn(campo, protegidos)

    @override_settings(STORAGES={"default": {"BACKEND": "django.core.files.storage.FileSystemStorage"}, "staticfiles": {"BACKEND": "django.contrib.staticfiles.storage.StaticFilesStorage"}})
    def test_django_admin_lista_y_detecta_stock_obsoleto(self):
        from .admin import ProductoInventarioForm
        self.client.force_login(self.admin)
        self.assertEqual(self.client.get("/admin/store/producto/").status_code, 200)
        producto = self.productos[0]
        self.assertEqual(self.client.get(f"/admin/store/producto/{producto.pk}/change/").status_code, 200)
        form = ProductoInventarioForm(instance=producto)
        form.cleaned_data = {"stock": 70, "stock_anterior": 50}
        Producto.objects.filter(pk=producto.pk).update(stock=49)
        from django.core.exceptions import ValidationError
        with self.assertRaises(ValidationError):
            form.clean()

    def test_total_fuera_de_rango_no_reserva_stock(self):
        self.productos[0].precio = Decimal("9999999999.99")
        self.productos[0].save()
        self.client.force_authenticate(self.cliente)
        r = self.client.post("/pagos/crear-preferencia", self.checkout(), format="json")
        self.assertEqual(r.status_code, 400)
        self.assertFalse(Pedido.objects.exists())
        self.productos[0].refresh_from_db()
        self.assertEqual(self.productos[0].stock, 50)

    def test_editar_precio_en_django_admin_no_sobrescribe_stock_concurrente(self):
        from types import SimpleNamespace
        producto = self.productos[0]
        Producto.objects.filter(pk=producto.pk).update(stock=49)
        producto.precio = Decimal("2000")
        admin.site._registry[Producto].save_model(RequestFactory().post("/admin/"), producto, SimpleNamespace(changed_data=["precio"]), True)
        producto.refresh_from_db()
        self.assertEqual(producto.stock, 49)
        self.assertEqual(producto.precio, Decimal("2000"))

    def test_entradas_malformadas_devuelven_400(self):
        for ruta in ("/auth/login", "/auth/registro"):
            self.assertEqual(self.client.post(ruta, [], format="json").status_code, 400)
        self.client.force_authenticate(self.cliente)
        datos = self.checkout(items=[{"tipo": "producto", "id": 10 ** 50, "cantidad": 1}])
        self.assertEqual(self.client.post("/pagos/crear-preferencia", datos, format="json").status_code, 400)
        with patch("store.views.firma_webhook_valida", return_value=True):
            for cuerpo in ([], {"data": []}, {"data": None}):
                self.assertEqual(self.client.post("/pagos/webhook", cuerpo, format="json").status_code, 400)

    @patch("store.emails.EmailMultiAlternatives.send", return_value=0)
    def test_registro_no_afirma_envio_si_backend_acepta_cero_mensajes(self, send):
        r = self.client.post("/auth/registro", {"nombre_completo": "Prueba", "email": "registro@example.test", "password": "SyntheticAuditPassword2026!"}, format="json")
        self.assertEqual(r.status_code, 201)
        self.assertFalse(r.data["correo_enviado"])
        self.assertFalse(get_user_model().objects.get(email="registro@example.test").is_active)

    @patch.dict(os.environ, {"MP_ACCESS_TOKEN": "test-only"})
    @patch("store.views.mercadopago.SDK")
    def test_pago_repetido_no_descuenta_dos_veces_y_reembolso_sale_del_ranking(self, sdk):
        pedido = self.pedido(estado="pendiente", producto=self.productos[2], cantidad=1)
        pedido.proveedor_pago = "mercado_pago"
        pedido.save()
        pago = {"external_reference": str(pedido.pk), "status": "approved", "currency_id": "ARS", "transaction_amount": "1000"}
        sdk.return_value.payment.return_value.get.return_value = {"status": 200, "response": pago}
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(procesar_notificacion_pago("123")[1], "aprobado")
            self.assertEqual(procesar_notificacion_pago("123")[1], "aprobado")
        self.productos[2].refresh_from_db()
        self.assertEqual(self.productos[2].stock, 49)
        self.assertEqual(len(mail.outbox), 1)
        pago["status"] = "refunded"
        self.assertEqual(procesar_notificacion_pago("123")[1], "reembolsado")
        self.assertEqual(self.client.get("/productos/destacados/").data[0]["id"], self.productos[0].pk)

    @patch.dict(os.environ, {"MP_ACCESS_TOKEN": "test-only"})
    @patch("store.views.mercadopago.SDK")
    def test_pago_con_importe_no_finito_se_envia_a_revision(self, sdk):
        pedido = self.pedido(estado="pendiente", producto=self.productos[0])
        pedido.proveedor_pago = "mercado_pago"
        pedido.save()
        sdk.return_value.payment.return_value.get.return_value = {"status": 200, "response": {"external_reference": str(pedido.pk), "status": "approved", "currency_id": "ARS", "transaction_amount": "sNaN"}}
        self.assertEqual(procesar_notificacion_pago("124")[1], "revision_pago")

    def test_tarifas_y_respuesta_ruta_invalidas_se_controlan(self):
        with patch.dict(os.environ, {"ENVIO_TARIFAS_KM_ARS": "NaN:1000"}):
            with self.assertRaises(ErrorCotizacionEnvio):
                tarifas_envio()
        for respuesta in ([], {"code": "Ok", "routes": [{"distance": -1}]}, {"code": "Ok", "routes": [{"distance": "NaN"}]}):
            cache.clear()
            with patch("store.shipping._json_de_url", return_value=respuesta), patch("store.shipping.time.sleep"):
                with self.assertRaises(ErrorCotizacionEnvio):
                    _distancia_ruta_metros((0, 0), (1, 1))


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class ConcurrenciaPostgresTests(TransactionTestCase):
    def test_combos_en_orden_inverso_no_generan_interbloqueo(self):
        if connection.vendor != "postgresql":
            self.skipTest("Requiere bloqueos reales de PostgreSQL")
        producto = Producto.objects.create(nombre="Compartido", slug="compartido", categoria="creatinas", precio=1000, stock=4)
        combos = [Combo.objects.create(nombre=f"Combo {i}", slug=f"combo-{i}", precio=1000) for i in range(2)]
        for combo in combos:
            combo.productos.add(producto)
        user = get_user_model().objects.create_user("concurrencia-combos", "combos@example.test")
        inicio = Barrier(2)

        def comprar(orden):
            close_old_connections()
            try:
                cliente = APIClient()
                cliente.force_authenticate(user)
                inicio.wait(timeout=10)
                return cliente.post("/pagos/crear-preferencia", {"checkout_key": str(uuid4()), "items": [{"tipo": "combo", "id": combos[i].pk, "cantidad": 1} for i in orden], "nombre_comprador": "Prueba", "telefono_comprador": "123", "email_comprador": user.email, "medio_pago": "local"}, format="json").status_code
            finally:
                connection.close()

        with ThreadPoolExecutor(max_workers=2) as pool:
            estados = list(pool.map(comprar, [(0, 1), (1, 0)]))
        self.assertEqual(estados, [201, 201])
        producto.refresh_from_db()
        self.assertEqual(producto.stock, 0)
        self.assertEqual(Pedido.objects.count(), 2)

    def test_dos_compras_simultaneas_no_sobrevenden(self):
        if connection.vendor != "postgresql":
            self.skipTest("Requiere bloqueos reales de PostgreSQL")
        producto = Producto.objects.create(nombre="Última unidad", slug="ultima", categoria="creatinas", precio=1000, stock=1)
        user = get_user_model().objects.create_user("concurrencia", "concurrencia@example.test")
        inicio = Barrier(2)

        def comprar():
            close_old_connections()
            try:
                cliente = APIClient()
                cliente.force_authenticate(user)
                inicio.wait(timeout=10)
                return cliente.post("/pagos/crear-preferencia", {"checkout_key": str(uuid4()), "items": [{"tipo": "producto", "id": producto.pk, "cantidad": 1}], "nombre_comprador": "Prueba", "telefono_comprador": "123", "email_comprador": user.email, "medio_pago": "local"}, format="json").status_code
            finally:
                connection.close()

        with ThreadPoolExecutor(max_workers=2) as pool:
            estados = list(pool.map(lambda _: comprar(), range(2)))
        self.assertEqual(sorted(estados), [201, 400])
        producto.refresh_from_db()
        self.assertEqual(producto.stock, 0)
        self.assertEqual(Pedido.objects.count(), 1)
