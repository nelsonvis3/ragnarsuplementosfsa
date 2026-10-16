import io
import json
from unittest.mock import patch
from uuid import uuid4

import cloudinary
from django.contrib.admin.models import ADDITION, CHANGE, DELETION, LogEntry
from django.contrib.auth import get_user_model
from django.contrib.auth.models import Permission
from django.core.cache import cache
from django.core.files.uploadedfile import SimpleUploadedFile
from PIL import Image
from rest_framework.test import APITestCase
from rest_framework_simplejwt.tokens import AccessToken

from .models import Combo, ItemPedido, Pedido, Producto
from .email_confirmation import crear_token_confirmacion


class AdministracionCatalogoTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        User = get_user_model()
        cls.admin = User.objects.create_superuser(username="JefeRagnar", email="jefe@example.test", password="SyntheticTestPassword2026!")
        cls.cliente = User.objects.create_user(username="cliente@example.test", email="cliente@example.test", password="SyntheticTestPassword2026!")
        cls.staff = User.objects.create_user(username="staff", is_staff=True)
        cls.producto = Producto.objects.create(nombre="Creatina de prueba", slug="creatina-prueba", categoria="creatinas", precio=12000, stock=10, imagen="/logo-ember.png")
        cls.otro = Producto.objects.create(nombre="Proteína de prueba", slug="proteina-prueba", categoria="proteinas", precio=20000, stock=4, imagen="/logo-ember.png")
        cls.combo = Combo.objects.create(nombre="Combo de prueba", slug="combo-prueba", precio=30000, imagen="/logo-ember.png")
        cls.combo.productos.set([cls.producto, cls.otro])

    def setUp(self):
        cache.clear()
        self.autenticar(self.admin)

    def autenticar(self, user):
        self.client.credentials(HTTP_AUTHORIZATION=f"Bearer {AccessToken.for_user(user)}" if user else "")

    def datos_producto(self, **kwargs):
        return {"nombre": "Producto nuevo", "slug": "producto-nuevo", "categoria": "vitaminas", "precio": 15000, "stock": 3, "imagen_url": "/logo-ember.png", "sabores": [], "activo": True, **kwargs}

    def url_producto(self, producto=None):
        return f"/administracion/productos/{(producto or self.producto).pk}/"

    def crear_pedido(self, producto=None, combo=None, componentes=None):
        pedido = Pedido.objects.create(nombre_comprador="Comprador de prueba", telefono_comprador="123456789", email_comprador="cliente@example.test", total=12000)
        ItemPedido.objects.create(pedido=pedido, producto=producto, combo=combo, componentes_combo=componentes or [], nombre="Artículo de prueba", cantidad=1, precio_unitario=12000)
        return pedido

    def test_anonimos_y_clientes_no_pueden_leer_ni_modificar(self):
        for user, status in ((None, 401), (self.cliente, 403), (self.staff, 403)):
            self.autenticar(user)
            for recurso in ("productos", "combos"):
                base = f"/administracion/{recurso}/"
                pk = self.producto.pk if recurso == "productos" else self.combo.pk
                with self.subTest(user=user, recurso=recurso):
                    self.assertEqual(self.client.get(base).status_code, status)
                    self.assertEqual(self.client.post(base, self.datos_producto(), format="json").status_code, status)
                    self.assertEqual(self.client.patch(f"{base}{pk}/", {"activo": False}, format="json").status_code, status)
                    self.assertEqual(self.client.delete(f"{base}{pk}/").status_code, status)
        self.assertEqual(Producto.objects.count(), 2)
        self.producto.refresh_from_db()
        self.assertTrue(self.producto.activo)

    def test_staff_con_todos_los_permisos_tampoco_puede_administrar(self):
        permisos = [f"{accion}_{modelo}" for modelo in ("producto", "combo") for accion in ("view", "add", "change", "delete")]
        self.staff.user_permissions.set(Permission.objects.filter(content_type__app_label="store", codename__in=permisos))
        self.autenticar(self.staff)
        for recurso, pk in (("productos", self.producto.pk), ("combos", self.combo.pk)):
            url = f"/administracion/{recurso}/"
            self.assertEqual(self.client.get(url).status_code, 403)
            self.assertEqual(self.client.post(url, {}, format="json").status_code, 403)
            self.assertEqual(self.client.patch(f"{url}{pk}/", {}, format="json").status_code, 403)
            self.assertEqual(self.client.delete(f"{url}{pk}/").status_code, 403)
        perfil = self.client.get("/auth/perfil").data
        self.assertFalse(perfil["puede_administrar_catalogo"])
        self.assertFalse(perfil["puede_recuperar_contrasena"])

    def test_cambio_de_superusuario_se_aplica_a_una_sesion_existente(self):
        self.admin.is_superuser = False
        self.admin.save(update_fields=["is_superuser"])
        self.assertEqual(self.client.get("/administracion/productos/").status_code, 403)
        self.assertFalse(self.client.get("/auth/perfil").data["puede_administrar_catalogo"])
        self.admin.is_superuser = True
        self.admin.save(update_fields=["is_superuser"])
        self.assertEqual(self.client.get("/administracion/productos/").status_code, 200)

    def test_registro_publico_no_puede_otorgar_permisos(self):
        self.autenticar(None)
        response = self.client.post("/auth/registro", {"nombre_completo": "Cliente nuevo", "email": "nuevo@example.test", "password": "SyntheticNewPassword2026!", "is_staff": True, "is_superuser": True}, format="json")
        self.assertEqual(response.status_code, 201)
        self.assertNotIn("token", response.data)
        nuevo = get_user_model().objects.get(email="nuevo@example.test")
        self.assertFalse(nuevo.is_staff or nuevo.is_superuser or nuevo.is_active)
        self.assertEqual(self.client.post("/auth/email/confirmar", {"token": crear_token_confirmacion(nuevo.verificacion_email)}, format="json").status_code, 200)
        nuevo.refresh_from_db()
        self.autenticar(nuevo)
        self.assertEqual(self.client.get("/administracion/productos/").status_code, 403)

    def test_login_admin_admite_usuario_y_email(self):
        self.autenticar(None)
        for identificador in ("JefeRagnar", "JEFE@example.test"):
            response = self.client.post("/auth/login", {"email": identificador, "password": "SyntheticTestPassword2026!"}, format="json")
            self.assertEqual(response.status_code, 200)
            self.assertTrue(response.data["usuario"]["puede_administrar_catalogo"])

    def test_crear_editar_publicar_y_despublicar_producto(self):
        response = self.client.post("/administracion/productos/", self.datos_producto(sabores=[{"nombre": "Vainilla", "imagen": ""}]), format="json")
        self.assertEqual(response.status_code, 201, response.data)
        producto = Producto.objects.get(pk=response.data["id"])
        self.assertEqual(self.client.get(f"/productos/{producto.slug}/").status_code, 200)
        response = self.client.patch(self.url_producto(producto), {"nombre": "Nombre editado", "stock": 7, "stock_anterior": 3, "precio": 16000, "activo": False}, format="json")
        self.assertEqual(response.status_code, 200, response.data)
        self.assertEqual(self.client.get(f"/productos/{producto.slug}/").status_code, 404)
        self.assertTrue(any(p["id"] == producto.pk for p in self.client.get("/administracion/productos/").data))
        self.assertEqual(self.client.patch(self.url_producto(producto), {"activo": True}, format="json").status_code, 200)
        self.assertEqual(self.client.get(f"/productos/{producto.slug}/").data["stock"], 7)
        self.assertEqual(list(LogEntry.objects.filter(object_id=producto.pk).order_by("id").values_list("action_flag", flat=True)), [ADDITION, CHANGE, CHANGE])

    def test_stock_modificado_por_una_compra_no_se_sobrescribe(self):
        Producto.objects.filter(pk=self.producto.pk).update(stock=8)
        response = self.client.patch(self.url_producto(), {"stock": 12, "stock_anterior": 10}, format="json")
        self.assertEqual(response.status_code, 409)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock, 8)
        self.assertEqual(self.client.patch(self.url_producto(), {"descripcion": "Nueva descripción"}, format="json").status_code, 200)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.stock, 8)

    def test_no_se_publican_precios_invalidos_stock_negativo_ni_sabores_repetidos(self):
        for cambio in ({"precio": -1}, {"precio": 0}, {"stock": -1}, {"slug": "creatina-prueba"}, {"sabores": [{"nombre": "Vainilla"}, {"nombre": "vainilla"}]}, {"imagen_url": "https://example.test/imagen.png"}):
            with self.subTest(cambio=cambio):
                response = self.client.post("/administracion/productos/", self.datos_producto(**cambio), format="json")
                self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(Producto.objects.count(), 2)

    def test_borrador_sin_imagen_no_se_puede_publicar(self):
        response = self.client.post("/administracion/productos/", self.datos_producto(imagen_url="", activo=False), format="json")
        self.assertEqual(response.status_code, 201)
        self.assertEqual(self.client.patch(f"/administracion/productos/{response.data['id']}/", {"activo": True}, format="json").status_code, 400)

    def test_eliminar_producto_sin_pedidos(self):
        producto = Producto.objects.create(nombre="Descartable", slug="descartable", categoria="vitaminas", precio=100)
        pk = producto.pk
        self.assertEqual(self.client.delete(self.url_producto(producto)).status_code, 204)
        self.assertFalse(Producto.objects.filter(pk=pk).exists())
        self.assertEqual(LogEntry.objects.get(object_id=pk).action_flag, DELETION)

    def test_producto_con_pedido_debe_despublicarse(self):
        producto = Producto.objects.create(nombre="Vendido", slug="vendido", categoria="vitaminas", precio=100)
        self.crear_pedido(producto=producto)
        self.assertEqual(self.client.delete(self.url_producto(producto)).status_code, 409)
        self.assertTrue(Producto.objects.filter(pk=producto.pk).exists())
        self.assertFalse(LogEntry.objects.filter(action_flag=DELETION).exists())
        self.assertEqual(self.client.patch(self.url_producto(producto), {"activo": False}, format="json").status_code, 200)
        self.assertEqual(ItemPedido.objects.count(), 1)

    def test_no_se_eliminan_componentes_de_combos_o_pedidos_historicos(self):
        self.assertEqual(self.client.delete(self.url_producto()).status_code, 409)
        self.crear_pedido(combo=self.combo, componentes=[self.producto.pk])
        self.combo.productos.clear()
        self.assertEqual(self.client.delete(self.url_producto()).status_code, 409)

    def test_combo_crud_y_stock_de_componentes(self):
        response = self.client.post("/administracion/combos/", {"nombre": "Nuevo combo", "slug": "nuevo-combo", "precio": 25000, "productos": [self.producto.pk, self.otro.pk], "imagen_url": "/logo-ember.png"}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        self.assertEqual(response.data["stock"], 4)
        url = f"/administracion/combos/{response.data['id']}/"
        self.assertEqual(self.client.patch(url, {"productos": [self.producto.pk]}, format="json").data["stock"], 10)
        self.assertEqual(self.client.delete(url).status_code, 204)

    def test_combo_con_pedidos_no_se_elimina(self):
        self.crear_pedido(combo=self.combo, componentes=[self.producto.pk, self.otro.pk])
        self.assertEqual(self.client.delete(f"/administracion/combos/{self.combo.pk}/").status_code, 409)
        self.assertEqual(ItemPedido.objects.count(), 1)

    def test_combo_incompleto_se_oculta_y_no_se_puede_comprar(self):
        self.assertEqual(self.client.get(f"/combos/{self.combo.slug}/").status_code, 200)
        self.client.patch(self.url_producto(), {"activo": False}, format="json")
        self.assertEqual(self.client.get(f"/combos/{self.combo.slug}/").status_code, 404)
        self.assertEqual(self.client.get("/combos/").data, [])
        self.assertEqual(self.client.get(f"/administracion/combos/{self.combo.pk}/").data["stock"], 0)
        response = self.client.post("/pagos/crear-preferencia", {"checkout_key": str(uuid4()), "items": [{"tipo": "combo", "id": self.combo.pk, "cantidad": 1}], "nombre_comprador": "Comprador", "telefono_comprador": "123456789", "email_comprador": "cliente@example.test", "medio_pago": "local", "forma_entrega": "retiro"}, format="json")
        self.assertEqual(response.status_code, 400, response.data)
        self.assertEqual(Pedido.objects.count(), 0)
        self.assertEqual(ItemPedido.objects.count(), 0)

    def test_combo_publicado_reserva_stock_y_conserva_sus_componentes(self):
        response = self.client.post("/pagos/crear-preferencia", {"checkout_key": str(uuid4()), "items": [{"tipo": "combo", "id": self.combo.pk, "cantidad": 2}], "nombre_comprador": "Comprador", "telefono_comprador": "123456789", "email_comprador": "cliente@example.test", "medio_pago": "local", "forma_entrega": "retiro"}, format="json")
        self.assertEqual(response.status_code, 201, response.data)
        pedido = Pedido.objects.get(pk=response.data["pedido_id"])
        self.assertTrue(pedido.stock_reservado)
        self.producto.refresh_from_db()
        self.otro.refresh_from_db()
        self.assertEqual((self.producto.stock, self.otro.stock), (8, 2))
        self.assertEqual(set(pedido.items.get().componentes_combo), {self.producto.pk, self.otro.pk})

    def imagen_subida(self):
        output = io.BytesIO()
        Image.new("RGB", (8, 8), "white").save(output, format="PNG")
        return SimpleUploadedFile("producto.png", output.getvalue(), content_type="image/png")

    @patch("store.catalog_admin.cloudinary.uploader.upload_image")
    def test_subir_imagen_multipart_preserva_sabores_y_genera_https(self, upload):
        upload.return_value = cloudinary.CloudinaryImage("ragnar/test", version="1", format="png")
        with patch.object(cloudinary.config(), "cloud_name", "ragnar-test", create=True):
            response = self.client.post("/administracion/productos/", {"datos": json.dumps(self.datos_producto(imagen_url="", sabores=[{"nombre": "Chocolate", "imagen": ""}])), "imagen_archivo": self.imagen_subida()}, format="multipart")
            self.assertEqual(response.status_code, 201, response.data)
            self.assertTrue(response.data["imagen"].startswith("https://res.cloudinary.com/"))
            self.assertEqual(response.data["sabores"], [{"nombre": "Chocolate", "imagen": ""}])
            self.assertEqual(self.client.get("/productos/producto-nuevo/").data["imagen"], response.data["imagen"])
        upload.assert_called_once()
        self.assertEqual(upload.call_args.kwargs["asset_folder"], "ragnar/productos")

    @patch("store.catalog_admin.cloudinary.uploader.upload_image", side_effect=RuntimeError("Provider error"))
    def test_error_de_cloudinary_no_guarda_cambios_parciales(self, upload):
        response = self.client.patch(self.url_producto(), {"datos": json.dumps({"nombre": "No debe guardarse"}), "imagen_archivo": self.imagen_subida()}, format="multipart")
        self.assertEqual(response.status_code, 400, response.data)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.nombre, "Creatina de prueba")
        self.assertFalse(LogEntry.objects.exists())
        upload.assert_called_once()

    @patch("store.catalog_admin.cloudinary.uploader.upload_image")
    def test_sube_imagenes_por_sabor_y_conserva_la_asignacion(self, upload):
        upload.side_effect = [cloudinary.CloudinaryImage("ragnar/chocolate", version="1", format="png"), cloudinary.CloudinaryImage("ragnar/vainilla", version="1", format="png")]
        datos = self.datos_producto(sabores=[{"nombre": "Chocolate", "imagen": ""}, {"nombre": "Sin sabor", "imagen": ""}, {"nombre": "Vainilla", "imagen": ""}])
        with patch.object(cloudinary.config(), "cloud_name", "ragnar-test", create=True):
            response = self.client.post("/administracion/productos/", {"datos": json.dumps(datos), "sabor_imagen_0": self.imagen_subida(), "sabor_imagen_2": self.imagen_subida()}, format="multipart")
        self.assertEqual(response.status_code, 201, response.data)
        sabores = response.data["sabores"]
        self.assertIn("ragnar/chocolate", sabores[0]["imagen"])
        self.assertEqual(sabores[1]["imagen"], "")
        self.assertIn("ragnar/vainilla", sabores[2]["imagen"])
        self.assertTrue(sabores[0]["imagen"].startswith("https://res.cloudinary.com/"))
        self.assertEqual(self.client.get("/productos/producto-nuevo/").data["sabores"], sabores)
        self.assertEqual(upload.call_count, 2)
        self.assertTrue(all(call.kwargs["asset_folder"] == "ragnar/productos/sabores" for call in upload.call_args_list))

    @patch("store.catalog_admin.cloudinary.uploader.upload_image")
    def test_reemplazar_solo_imagen_de_sabor_conserva_los_demas_campos(self, upload):
        self.producto.sabores = [{"nombre": "Vainilla", "imagen": "/logo.png"}]
        self.producto.save()
        upload.return_value = cloudinary.CloudinaryImage("ragnar/reemplazo", version="1", format="png")
        with patch.object(cloudinary.config(), "cloud_name", "ragnar-test", create=True):
            response = self.client.patch(self.url_producto(), {"datos": json.dumps({"sabores": self.producto.sabores}), "sabor_imagen_0": self.imagen_subida()}, format="multipart")
        self.assertEqual(response.status_code, 200, response.data)
        self.producto.refresh_from_db()
        self.assertIn("ragnar/reemplazo", self.producto.sabores[0]["imagen"])
        self.assertEqual(self.producto.stock, 10)
        self.assertEqual(self.producto.nombre, "Creatina de prueba")

    @patch("store.catalog_admin.cloudinary.uploader.upload_image")
    def test_archivo_de_sabor_invalido_no_sube_ninguna_imagen(self, upload):
        datos = self.datos_producto(sabores=[{"nombre": "Chocolate"}])
        response = self.client.post("/administracion/productos/", {"datos": json.dumps(datos), "imagen_archivo": self.imagen_subida(), "sabor_imagen_0": SimpleUploadedFile("falso.png", b"not an image", content_type="image/png")}, format="multipart")
        self.assertEqual(response.status_code, 400, response.data)
        upload.assert_not_called()
        self.assertEqual(Producto.objects.count(), 2)

    @patch("store.catalog_admin.cloudinary.uploader.upload_image", side_effect=RuntimeError("Provider error"))
    def test_error_al_subir_sabor_conserva_datos_e_imagen_anterior(self, upload):
        self.producto.sabores = [{"nombre": "Chocolate", "imagen": "/logo.png"}]
        self.producto.save()
        response = self.client.patch(self.url_producto(), {"datos": json.dumps({"nombre": "No guardar", "sabores": self.producto.sabores}), "sabor_imagen_0": self.imagen_subida()}, format="multipart")
        self.assertEqual(response.status_code, 400, response.data)
        self.producto.refresh_from_db()
        self.assertEqual(self.producto.sabores, [{"nombre": "Chocolate", "imagen": "/logo.png"}])
        self.assertEqual(self.producto.nombre, "Creatina de prueba")
        self.assertFalse(LogEntry.objects.exists())

    @patch("store.catalog_admin.cloudinary.uploader.upload_image")
    def test_imagen_sin_sabor_asociado_no_se_ignora(self, upload):
        for campo in ("sabor_imagen_1", "sabor_imagen_invalido", "sabor_imagen_-1"):
            response = self.client.post("/administracion/productos/", {"datos": json.dumps(self.datos_producto(sabores=[{"nombre": "Chocolate"}])), campo: self.imagen_subida()}, format="multipart")
            self.assertEqual(response.status_code, 400, response.data)
        upload.assert_not_called()

    @patch("store.catalog_admin.cloudinary.uploader.upload_image")
    def test_archivo_invalido_no_llega_a_cloudinary(self, upload):
        response = self.client.post("/administracion/productos/", {"datos": json.dumps(self.datos_producto()), "imagen_archivo": SimpleUploadedFile("falso.png", b"not an image", content_type="image/png")}, format="multipart")
        self.assertEqual(response.status_code, 400)
        upload.assert_not_called()

    def test_multipart_json_invalido_no_crea_producto(self):
        response = self.client.post("/administracion/productos/", {"datos": "no-json"}, format="multipart")
        self.assertEqual(response.status_code, 400)
        self.assertEqual(Producto.objects.count(), 2)
