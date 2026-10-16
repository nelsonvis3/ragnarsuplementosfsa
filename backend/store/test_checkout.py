from datetime import timedelta
from decimal import Decimal
from uuid import uuid4

from django.core.cache import cache
from django.utils import timezone
from rest_framework.test import APITestCase

from .models import Pedido, Producto


class CheckoutTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.producto = Producto.objects.create(nombre="Creatina de prueba", slug="creatina-prueba", categoria="creatinas", precio=12000, stock=10, imagen="/logo-ember.png")

    def setUp(self):
        cache.clear()

    def comprar(self, cantidad, **extra_item):
        return self.client.post("/pagos/crear-preferencia", {
            "checkout_key": str(uuid4()),
            "items": [{"tipo": "producto", "id": self.producto.pk, "cantidad": cantidad, **extra_item}],
            "nombre_comprador": "Comprador",
            "telefono_comprador": "123456789",
            "email_comprador": "cliente@example.test",
            "medio_pago": "local",
            "forma_entrega": "retiro",
            "total": "1.00",
        }, format="json")

    def test_el_total_sale_del_catalogo_y_no_del_navegador(self):
        response = self.comprar(2, precio=1)
        self.assertEqual(response.status_code, 201, response.data)
        pedido = Pedido.objects.get(pk=response.data["pedido_id"])
        self.assertEqual(pedido.total, Decimal("24000.00"))
        self.assertEqual(pedido.items.get().precio_unitario, Decimal("12000.00"))

    def test_una_reserva_vencida_devuelve_el_stock_al_consultar_el_catalogo(self):
        response = self.comprar(3)
        self.assertEqual(response.status_code, 201, response.data)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock, 7)

        Pedido.objects.filter(pk=response.data["pedido_id"]).update(stock_reservado_hasta=timezone.now() - timedelta(minutes=1))
        self.assertEqual(self.client.get("/productos/").status_code, 200)

        self.producto.refresh_from_db()
        pedido = Pedido.objects.get(pk=response.data["pedido_id"])
        self.assertEqual(self.producto.stock, 10)
        self.assertEqual(pedido.estado, "cancelado")
        self.assertFalse(pedido.stock_reservado)
