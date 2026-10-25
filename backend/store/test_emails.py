from django.core import mail
from django.test import TestCase, override_settings

from .emails import enviar_confirmacion_pedido
from .models import ItemPedido, Pedido, Producto


@override_settings(EMAIL_BACKEND="django.core.mail.backends.locmem.EmailBackend")
class EmailPedidoTests(TestCase):
    def test_muestra_productos_descuento_y_total_con_logo_adjunto(self):
        producto = Producto.objects.create(nombre="Creatina", slug="creatina", precio=10000, stock=5)
        # 2 × 10.000 de productos + 3.000 de envío − 10 % de premio (2.000) = 21.000
        pedido = Pedido.objects.create(nombre_comprador="Cliente", email_comprador="cliente@example.test", telefono_comprador="123",
                                       total=21000, costo_envio=3000, descuento=2000, proveedor_pago="transferencia",
                                       forma_entrega="envio", direccion_entrega="Calle <b>1</b>")
        ItemPedido.objects.create(pedido=pedido, producto=producto, nombre="Creatina", cantidad=2, precio_unitario=10000)

        enviar_confirmacion_pedido(pedido, "transferencia")

        correo = mail.outbox[0]
        html = correo.alternatives[0].content
        for texto in ("Productos: $20.000", "Premio del juego: -$2.000", "Envío: $3.000", "Total: $21.000"):
            self.assertIn(texto, correo.body)
        for texto in ("$20.000", "−$2.000", "$21.000", 'src="cid:ragnar-logo"', 'max-width:600px'):
            self.assertIn(texto, html)
        self.assertIn("Calle &lt;b&gt;1&lt;/b&gt;", html)
        self.assertEqual(correo.attachments[0]["Content-ID"], "<ragnar-logo>")
