import os
from datetime import timedelta
from unittest.mock import patch
from uuid import uuid4

from django.contrib.admin.models import LogEntry
from django.contrib.auth import get_user_model
from django.core import mail
from django.utils import timezone
from django.test import override_settings
from rest_framework.test import APITestCase

from .models import ItemPedido, Pedido, Producto


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend", MP_ENABLED=False)
class AdministracionPedidosTests(APITestCase):
    def setUp(self):
        self.owner = get_user_model().objects.create_superuser("owner", "owner@example.test", "SyntheticOwner2026!")
        self.client.force_authenticate(self.owner)
        self.producto = Producto.objects.create(nombre="Creatina actual", slug="creatina-actual", precio=1000, stock=8)
        self.pedido = Pedido.objects.create(nombre_comprador="Cliente", email_comprador="cliente@example.test", telefono_comprador="123456789", total=2000, proveedor_pago="transferencia", stock_reservado=True, stock_reservado_hasta=timezone.now() + timedelta(hours=1))
        ItemPedido.objects.create(pedido=self.pedido, producto=self.producto, nombre="Creatina original", sabor="Frutilla", cantidad=2, precio_unitario=1000)

    def gestionar(self, accion, **kwargs):
        return self.client.post(f"/administracion/pedidos/{self.pedido.pk}/gestionar/", {"accion": accion, "actualizado": self.pedido.actualizado.isoformat(), **kwargs}, format="json")

    def test_solo_superusuario_puede_ver_y_gestionar(self):
        cliente = get_user_model().objects.create_user("cliente")
        staff = get_user_model().objects.create_user("staff", is_staff=True)
        for usuario, estado in ((None, 401), (cliente, 403), (staff, 403)):
            self.client.force_authenticate(usuario)
            self.assertEqual(self.client.get("/administracion/pedidos/").status_code, estado)
            self.assertEqual(self.client.get(f"/administracion/pedidos/{self.pedido.pk}/").status_code, estado)
            self.assertEqual(self.gestionar("aprobar").status_code, estado)
        self.pedido.refresh_from_db()
        self.assertEqual(self.pedido.estado, "pendiente")

    def test_lista_busqueda_y_detalle_usan_snapshot_del_producto(self):
        respuesta = self.client.get("/administracion/pedidos/?buscar=original&estado=pendiente")
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta["Cache-Control"], "no-store")
        self.assertEqual(respuesta.data["count"], 1)
        pedido = respuesta.data["results"][0]
        self.assertEqual(pedido["nombre_pedido"], "Creatina original (Frutilla) ×2")
        self.assertEqual(pedido["items"][0]["cantidad"], 2)
        self.assertEqual(pedido["acciones"], ["aprobar", "cancelar"])
        self.assertNotIn("checkout_key", pedido)
        self.assertEqual(self.client.get("/administracion/pedidos/?estado=aprobado").data["count"], 0)
        self.assertEqual(self.client.get("/administracion/pedidos/?estado=inventado").status_code, 400)

    def test_aprobar_no_descuenta_dos_veces_y_registra_accion(self):
        with self.captureOnCommitCallbacks(execute=True):
            respuesta = self.gestionar("aprobar")
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data["pedido"]["estado"], "aprobado")
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock, 8)
        self.assertEqual(LogEntry.objects.filter(user=self.owner).count(), 1)
        self.assertEqual(len(mail.outbox), 1)
        self.assertIn("Creatina original", mail.outbox[0].subject)
        self.assertEqual(self.gestionar("aprobar").status_code, 409)
        self.assertEqual(len(mail.outbox), 1)

    def test_cancelar_devuelve_stock_una_vez_y_conserva_historial(self):
        self.assertEqual(self.gestionar("cancelar").status_code, 200)
        self.assertEqual(self.gestionar("cancelar").status_code, 409)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock, 10)
        self.assertTrue(Pedido.objects.filter(pk=self.pedido.pk).exists())
        self.assertEqual(self.client.delete(f"/administracion/pedidos/{self.pedido.pk}/").status_code, 405)
        self.assertEqual(self.client.patch(f"/administracion/pedidos/{self.pedido.pk}/", {"total": 1}, format="json").status_code, 405)

    def test_version_obsoleta_no_modifica_el_pedido(self):
        Pedido.objects.filter(pk=self.pedido.pk).update(actualizado=timezone.now())
        self.assertEqual(self.gestionar("cancelar").status_code, 409)
        self.pedido.refresh_from_db()
        self.assertEqual(self.pedido.estado, "pendiente")

    def test_no_confirma_reservas_vencidas(self):
        self.pedido.stock_reservado_hasta = timezone.now() - timedelta(minutes=1)
        self.pedido.save()
        self.assertEqual(self.gestionar("aprobar").status_code, 409)
        self.pedido.refresh_from_db(); self.producto.refresh_from_db()
        self.assertEqual(self.pedido.estado, "cancelado")
        self.assertEqual(self.producto.stock, 10)

    def test_no_se_aprueba_manualmente_mercado_pago_y_cierre_exige_verificacion(self):
        self.pedido.proveedor_pago = "mercado_pago"
        self.pedido.estado = "revision_pago"
        self.pedido.pago_id = "123"
        self.pedido.save()
        self.assertEqual(self.gestionar("aprobar").status_code, 409)
        self.assertEqual(self.gestionar("cerrar_reembolsado").status_code, 400)
        self.assertEqual(self.gestionar("cerrar_reembolsado", verificado_proveedor=True).status_code, 200)
        self.pedido.refresh_from_db()
        self.assertEqual(self.pedido.estado, "reembolsado")

    def test_fallo_al_registrar_la_accion_revierte_estado_y_no_envia_correo(self):
        with patch("store.order_admin.LogEntry.objects.log_actions", side_effect=RuntimeError("Error de prueba")):
            with self.captureOnCommitCallbacks(execute=True), self.assertRaises(RuntimeError):
                self.gestionar("aprobar")
        self.pedido.refresh_from_db()
        self.assertEqual(self.pedido.estado, "pendiente")
        self.assertEqual(len(mail.outbox), 0)

    def test_manual_sin_reserva_se_puede_completar_tras_reponer_stock(self):
        self.pedido.stock_reservado = False
        self.pedido.save()
        self.producto.stock = 0
        self.producto.save()
        self.assertEqual(self.gestionar("aprobar").status_code, 409)
        self.pedido.refresh_from_db()
        self.assertEqual(self.pedido.estado, "revisar_stock")
        self.producto.stock = 3
        self.producto.save()
        with self.captureOnCommitCallbacks(execute=True):
            self.assertEqual(self.gestionar("aprobar").status_code, 200)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock, 1)

    def test_completar_stock_de_pago_mp_aprobado(self):
        self.pedido.proveedor_pago = "mercado_pago"
        self.pedido.estado = "revisar_stock"
        self.pedido.stock_reservado = False
        self.pedido.stock_reservado_hasta = None
        self.pedido.pago_id = "123"
        self.pedido.save()
        with self.captureOnCommitCallbacks(execute=True):
            respuesta = self.gestionar("completar_stock")
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock, 6)
        self.assertEqual(len(mail.outbox), 1)
        self.assertEqual(self.gestionar("completar_stock").status_code, 409)

    @patch.dict(os.environ, {"MP_ACCESS_TOKEN": "test-only"})
    @patch("store.views.mercadopago.SDK")
    def test_consultar_mp_confirma_desde_proveedor_y_no_notifica_si_revierte(self, sdk):
        self.pedido.proveedor_pago = "mercado_pago"
        self.pedido.pago_id = "123"
        self.pedido.save()
        sdk.return_value.payment.return_value.get.return_value = {"status": 200, "response": {
            "external_reference": str(self.pedido.pk), "status": "approved", "currency_id": "ARS", "transaction_amount": "2000"}}
        with patch("store.order_admin.LogEntry.objects.log_actions", side_effect=RuntimeError("Error de prueba")):
            with self.captureOnCommitCallbacks(execute=True), self.assertRaises(RuntimeError):
                self.gestionar("consultar_pago")
        self.pedido.refresh_from_db()
        self.assertEqual(self.pedido.estado, "pendiente")
        self.assertEqual(len(mail.outbox), 0)
        with self.captureOnCommitCallbacks(execute=True):
            respuesta = self.gestionar("consultar_pago")
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        self.assertEqual(respuesta.data["pedido"]["estado"], "aprobado")
        self.assertEqual(len(mail.outbox), 1)

    def test_paginacion_y_busqueda_por_referencia(self):
        Pedido.objects.bulk_create([Pedido(nombre_comprador=f"Cliente {i}", email_comprador="cliente@example.test", telefono_comprador="123", total=1, proveedor_pago="local") for i in range(22)])
        self.assertEqual(len(self.client.get("/administracion/pedidos/").data["results"]), 20)
        self.assertEqual(len(self.client.get("/administracion/pedidos/?page=2").data["results"]), 3)
        self.assertEqual(self.client.get("/administracion/pedidos/", {"buscar": f"#{self.pedido.pk}"}).data["count"], 1)

    def test_checkout_y_reintento_conservan_nombres_del_pedido(self):
        cliente = get_user_model().objects.create_user("compra", email="compra@example.test")
        self.client.force_authenticate(cliente)
        datos = {"checkout_key": str(uuid4()), "items": [{"tipo": "producto", "id": self.producto.pk, "cantidad": 1}], "nombre_comprador": "Compra", "telefono_comprador": "123", "email_comprador": cliente.email, "medio_pago": "local"}
        primera = self.client.post("/pagos/crear-preferencia", datos, format="json")
        self.assertEqual(primera.status_code, 201, primera.data)
        self.producto.nombre = "Nombre modificado"; self.producto.save()
        segunda = self.client.post("/pagos/crear-preferencia", datos, format="json")
        self.assertEqual(segunda.status_code, 200, segunda.data)
        self.assertEqual(primera.data["nombre_pedido"], segunda.data["nombre_pedido"])
        self.assertEqual(segunda.data["items"][0]["nombre"], "Creatina actual")
