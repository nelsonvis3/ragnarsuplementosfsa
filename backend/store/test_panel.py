from decimal import Decimal
from unittest.mock import patch
from uuid import uuid4

from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from .models import Combo, ConfiguracionJuego, ConfiguracionTienda, ItemPedido, Pedido, Premio, Producto, SolicitudAtencion, VisitaDia, VisitanteDia


class PanelTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner = get_user_model().objects.create_superuser("owner", "owner@example.test", "SyntheticOwner2026!")
        self.cliente = get_user_model().objects.create_user("cliente@example.test", "cliente@example.test", "SyntheticCliente2026!")

    def test_visitas_se_cuentan_sin_datos_personales_y_sin_bots(self):
        for ruta in ("/", "/", "/productos", "/administracion", "javascript:x"):
            self.assertEqual(self.client.post("/analitica/visita", {"ruta": ruta}, format="json", HTTP_USER_AGENT="Mozilla/5.0").status_code, 204)
        self.client.post("/analitica/visita", {"ruta": "/"}, format="json", HTTP_USER_AGENT="Googlebot/2.1")
        self.assertEqual(dict(VisitaDia.objects.values_list("ruta", "vistas")), {"/": 2, "/productos": 1})
        self.assertEqual(VisitanteDia.objects.count(), 1)
        self.assertNotIn("127.0.0.1", VisitanteDia.objects.get().huella)

    def test_resumen_y_solicitudes_solo_para_superusuario(self):
        SolicitudAtencion.objects.create(tipo="consulta", nombre="Ana", email="ana@example.test", mensaje="Hola")
        for usuario, estado in ((None, 401), (self.cliente, 403)):
            self.client.force_authenticate(usuario)
            self.assertEqual(self.client.get("/administracion/resumen/").status_code, estado)
            self.assertEqual(self.client.get("/administracion/solicitudes/").status_code, estado)
        self.client.force_authenticate(self.owner)
        resumen = self.client.get("/administracion/resumen/?dias=7").data
        self.assertEqual((resumen["consultas_pendientes"], len(resumen["serie"])), (1, 7))
        solicitud = self.client.get("/administracion/solicitudes/").data[0]
        self.assertEqual(self.client.patch(f"/administracion/solicitudes/{solicitud['id']}/", {"estado": "resuelta", "mensaje": "otro"}, format="json").data["mensaje"], "Hola")
        self.assertEqual(SolicitudAtencion.objects.get().estado, "resuelta")


class JuegoTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.producto = Producto.objects.create(nombre="Creatina", slug="creatina-juego", categoria="creatina", precio=10000, stock=10)
        self.cliente = get_user_model().objects.create_user("cliente@example.test", "cliente@example.test", "SyntheticCliente2026!")
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(self.cliente)}")

    def comprar(self, usar_premio=True):
        return self.client.post("/pagos/crear-preferencia", {
            "checkout_key": str(uuid4()), "items": [{"tipo": "producto", "id": self.producto.pk, "cantidad": 2}],
            "nombre_comprador": "Cliente", "telefono_comprador": "123456789", "email_comprador": "cliente@example.test",
            "medio_pago": "local", "forma_entrega": "retiro", "usar_premio": usar_premio,
        }, format="json")

    def test_un_premio_por_cuenta_y_el_visitante_no_juega(self):
        self.assertEqual(self.client.get("/juego").data["puede_jugar"], True)
        with patch("store.juego.sortear", return_value=("porcentaje", 10)):
            primero = self.client.post("/juego/jugar").data["premio"]
        segundo = self.client.post("/juego/jugar").data
        self.assertEqual((primero["porcentaje"], segundo["nuevo"], segundo["premio"]["porcentaje"]), (10, False, 10))
        self.assertEqual(Premio.objects.count(), 1)
        self.assertFalse(self.client.get("/juego").data["puede_jugar"])
        self.client.credentials()
        self.assertEqual(self.client.post("/juego/jugar").status_code, 401)
        self.assertFalse(self.client.get("/juego").data["puede_jugar"])

    def test_el_descuento_se_aplica_en_el_servidor_una_sola_vez_y_vuelve_si_se_cancela(self):
        with patch("store.juego.sortear", return_value=("porcentaje", 10)):
            self.client.post("/juego/jugar")
        compra = self.comprar()
        self.assertEqual(compra.status_code, 201, compra.data)
        pedido = Pedido.objects.get(pk=compra.data["pedido_id"])
        self.assertEqual((pedido.total, pedido.descuento), (Decimal("18000.00"), Decimal("2000.00")))
        self.assertEqual(self.comprar().status_code, 400)
        pedido.estado = "cancelado"
        pedido.save()
        self.assertEqual(Pedido.objects.get(pk=self.comprar().data["pedido_id"]).descuento, Decimal("2000.00"))

    def test_envio_gratis_exige_envio_y_el_juego_apagado_no_entrega_premios(self):
        with patch("store.juego.sortear", return_value=("envio_gratis", 0)):
            self.client.post("/juego/jugar")
        self.assertEqual(self.comprar().status_code, 400)
        Premio.objects.all().delete()
        ConfiguracionJuego.objects.update_or_create(pk=1, defaults={"activo": False})
        self.assertEqual(self.client.post("/juego/jugar").status_code, 409)


    def test_una_compra_aprobada_de_5_productos_da_otra_jugada(self):
        from .models import Combo, ItemPedido
        self.client.post("/juego/jugar")
        pedido = Pedido.objects.create(usuario=self.cliente, nombre_comprador="C", telefono_comprador="1", email_comprador="cliente@example.test", total=1, estado="pendiente")
        combo = Combo.objects.create(nombre="Combo", slug="combo-juego", precio=1)
        ItemPedido.objects.create(pedido=pedido, producto=self.producto, nombre="Creatina", cantidad=3, precio_unitario=1)
        ItemPedido.objects.create(pedido=pedido, combo=combo, nombre="Combo", cantidad=1, precio_unitario=1, componentes_combo=[self.producto.pk, self.producto.pk])
        self.assertFalse(self.client.get("/juego").data["puede_jugar"])
        Pedido.objects.filter(pk=pedido.pk).update(estado="aprobado")
        self.assertTrue(self.client.get("/juego").data["puede_jugar"])
        self.assertEqual(self.client.post("/juego/jugar").status_code, 201)
        self.assertEqual((Premio.objects.count(), self.client.post("/juego/jugar").data["nuevo"]), (2, False))


class AdministracionTiendaTests(APITestCase):
    def setUp(self):
        cache.clear()
        self.owner = get_user_model().objects.create_superuser("owner", "owner@example.test", "SyntheticOwner2026!")
        self.cliente = get_user_model().objects.create_user("cliente@example.test", "cliente@example.test", "SyntheticCliente2026!", first_name="Ana")
        self.creatina = Producto.objects.create(nombre="Creatina", slug="creatina", categoria="creatina", precio=10000, stock=5)
        self.proteina = Producto.objects.create(nombre="Proteína", slug="proteina", categoria="proteinas", precio=20000, stock=3, sabores=["Chocolate"])
        self.combo = Combo.objects.create(nombre="Combo", slug="combo", precio=27000)
        self.combo.productos.set([self.creatina, self.proteina])
        self.client.force_authenticate(self.owner)

    def test_solo_superusuario(self):
        for usuario, esperado in ((None, 401), (self.cliente, 403)):
            self.client.force_authenticate(usuario)
            for ruta in ("/administracion/tienda/", "/administracion/clientes/"):
                self.assertEqual(self.client.get(ruta).status_code, esperado, ruta)
            self.assertEqual(self.client.post("/administracion/ventas-mostrador/", {}, format="json").status_code, esperado)

    @patch.dict("os.environ", {"PAGO_ALIAS": "alias.del.env", "PAGO_CVU": ""})
    def test_configuracion_valida_y_reemplaza_al_env(self):
        self.assertEqual(self.client.get("/administracion/tienda/").data["vigente"]["pago_alias"], "alias.del.env")
        for campo, valor in (("pago_alias", "a b"), ("pago_cvu", "123"), ("envio_tarifas", "1:x")):
            self.assertEqual(self.client.patch("/administracion/tienda/", {campo: valor}, format="json").status_code, 400, campo)
        respuesta = self.client.patch("/administracion/tienda/", {"pago_alias": "ragnar.local", "pago_cvu": "0000003100012345678901", "envio_tarifas": "2:0,6:1500"}, format="json")
        self.assertEqual(respuesta.status_code, 200, respuesta.data)
        transferencia = next(m for m in self.client.get("/pagos/metodos").data if m["id"] == "transferencia")
        self.assertEqual((transferencia["alias"], transferencia["cvu"]), ("ragnar.local", "0000003100012345678901"))
        from .shipping import tarifas_envio
        self.assertEqual(tarifas_envio(), [(Decimal("2"), Decimal("0")), (Decimal("6"), Decimal("1500"))])

    def test_clientes_muestra_compras_aprobadas(self):
        for estado in ("aprobado", "aprobado", "cancelado"):
            Pedido.objects.create(usuario=self.cliente, nombre_comprador="Ana", telefono_comprador="1", email_comprador=self.cliente.email, total=1000, estado=estado)
        fila = self.client.get("/administracion/clientes/?q=ana").data
        self.assertEqual([(f["email"], f["compras"], f["gastado"]) for f in fila], [("cliente@example.test", 2, 2000.0)])
        self.assertEqual(self.client.get("/administracion/clientes/?q=nadie").data, [])

    def test_venta_mostrador_descuenta_stock_es_idempotente_y_se_anula(self):
        datos = {"venta_key": str(uuid4()), "medio_pago": "local", "items": [
            {"tipo": "producto", "id": self.proteina.pk, "cantidad": 1, "sabor": "Chocolate"},
            {"tipo": "combo", "id": self.combo.pk, "cantidad": 2}]}
        respuesta = self.client.post("/administracion/ventas-mostrador/", datos, format="json")
        self.assertEqual(respuesta.status_code, 201, respuesta.data)
        self.assertEqual(self.client.post("/administracion/ventas-mostrador/", datos, format="json").data["pedido_id"], respuesta.data["pedido_id"])
        pedido = Pedido.objects.get(pk=respuesta.data["pedido_id"])
        self.assertEqual((pedido.canal, pedido.estado, pedido.total, pedido.stock_reservado), ("mostrador", "aprobado", Decimal("74000"), False))
        self.creatina.refresh_from_db(); self.proteina.refresh_from_db()
        self.assertEqual((self.creatina.stock, self.proteina.stock), (3, 0))
        sin_stock = {**datos, "venta_key": str(uuid4()), "items": [{"tipo": "producto", "id": self.creatina.pk, "cantidad": 4}]}
        self.assertEqual(self.client.post("/administracion/ventas-mostrador/", sin_stock, format="json").status_code, 400)
        self.assertEqual(Pedido.objects.count(), 1)
        anular = self.client.post(f"/administracion/pedidos/{pedido.pk}/gestionar/", {"accion": "anular_mostrador", "actualizado": pedido.actualizado.isoformat()}, format="json")
        self.assertEqual(anular.status_code, 200, anular.data)
        self.creatina.refresh_from_db(); self.proteina.refresh_from_db()
        self.assertEqual((self.creatina.stock, self.proteina.stock, Pedido.objects.get(pk=pedido.pk).estado), (5, 3, "cancelado"))
