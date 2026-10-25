import os
import uuid

from django.conf import settings
from django.db import models
from cloudinary.models import CloudinaryField


class VerificacionEmail(models.Model):
    usuario = models.OneToOneField(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="verificacion_email")
    email = models.EmailField(max_length=254)
    codigo = models.UUIDField(default=uuid.uuid4, editable=False)
    creado = models.DateTimeField(auto_now_add=True)
    confirmado_en = models.DateTimeField(null=True, blank=True)

    class Meta:
        verbose_name = "confirmación de email"
        verbose_name_plural = "confirmaciones de email"

    def __str__(self):
        return f"{self.email} ({'confirmado' if self.confirmado_en else 'pendiente'})"


class Categoria(models.Model):
    nombre = models.CharField(max_length=80, unique=True)
    slug = models.SlugField(max_length=80, unique=True)

    class Meta:
        ordering = ["nombre", "id"]

    def __str__(self):
        return self.nombre


class Producto(models.Model):
    slug = models.SlugField(unique=True)
    nombre = models.CharField(max_length=180)
    categoria = models.CharField(max_length=80, db_index=True)
    precio = models.DecimalField(max_digits=12, decimal_places=2)
    imagen = models.CharField(max_length=500, blank=True)
    imagen_archivo = CloudinaryField(
        "imagen subida",
        blank=True,
        null=True,
        asset_folder="ragnar/productos",
        use_asset_folder_as_public_id_prefix=True,
    )
    descripcion = models.TextField(blank=True)
    sabores = models.JSONField(default=list, blank=True)
    stock = models.PositiveIntegerField(default=0)
    activo = models.BooleanField(default=True)
    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre


class Combo(models.Model):
    slug = models.SlugField(unique=True)
    nombre = models.CharField(max_length=180)
    descripcion = models.TextField(blank=True)
    precio = models.DecimalField(max_digits=12, decimal_places=2)
    imagen = models.CharField(max_length=500, blank=True)
    imagen_archivo = CloudinaryField(
        "imagen subida",
        blank=True,
        null=True,
        asset_folder="ragnar/combos",
        use_asset_folder_as_public_id_prefix=True,
    )
    productos = models.ManyToManyField(Producto, related_name="combos", blank=True)
    activo = models.BooleanField(default=True)
    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["nombre"]

    def __str__(self):
        return self.nombre

    @property
    def stock(self):
        productos = list(self.productos.all())
        return min((p.stock for p in productos), default=0) if all(p.activo for p in productos) else 0


class Pedido(models.Model):
    FORMAS_ENTREGA = [
        ("retiro", "Retiro en el local"),
        ("envio", "Envío a domicilio"),
    ]
    MEDIOS_PAGO = [
        ("mercado_pago", "Mercado Pago"),
        ("transferencia", "Transferencia Personal Pay"),
        ("local", "Pago en el local"),
    ]
    ESTADOS = [
        ("pendiente", "Pendiente"),
        ("aprobado", "Aprobado"),
        ("rechazado", "Rechazado"),
        ("cancelado", "Cancelado"),
        ("revisar_stock", "Revisar stock"),
        ("revision_pago", "Revisar pago"),
        ("reembolsado", "Reembolsado"),
        ("contracargo", "Contracargo"),
    ]
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL)
    nombre_comprador = models.CharField(max_length=150)
    telefono_comprador = models.CharField(max_length=30)
    email_comprador = models.EmailField()
    total = models.DecimalField(max_digits=12, decimal_places=2)
    estado = models.CharField(max_length=16, choices=ESTADOS, default="pendiente", db_index=True)
    proveedor_pago = models.CharField(max_length=30, choices=MEDIOS_PAGO, default="mercado_pago")
    stock_reservado = models.BooleanField(default=False)
    stock_reservado_hasta = models.DateTimeField(null=True, blank=True, db_index=True)
    forma_entrega = models.CharField(max_length=10, choices=FORMAS_ENTREGA, default="retiro")
    direccion_entrega = models.CharField(max_length=300, blank=True)
    distancia_envio_km = models.DecimalField(max_digits=7, decimal_places=1, null=True, blank=True)
    costo_envio = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    descuento = models.DecimalField(max_digits=12, decimal_places=2, default=0)
    CANALES = [("web", "Tienda online"), ("mostrador", "Venta en mostrador")]
    canal = models.CharField(max_length=10, choices=CANALES, default="web", db_index=True)
    preferencia_id = models.CharField(max_length=120, blank=True)
    preferencia_url = models.URLField(max_length=1000, blank=True)
    checkout_key = models.UUIDField(unique=True, null=True, blank=True, editable=False)
    checkout_payload_hash = models.CharField(max_length=64, blank=True)
    pago_id = models.CharField(max_length=120, blank=True, unique=True, null=True)
    pagos_adicionales = models.JSONField(default=list, blank=True)
    creado = models.DateTimeField(auto_now_add=True)
    actualizado = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ["-creado"]

    def __str__(self):
        return f"Pedido #{self.pk} ({self.estado})"


class SolicitudAtencion(models.Model):
    TIPOS = [
        ("arrepentimiento", "Arrepentimiento"),
        ("reclamo", "Reclamo"),
        ("consulta", "Consulta"),
    ]
    ESTADOS = [
        ("pendiente", "Pendiente"),
        ("en_proceso", "En proceso"),
        ("resuelta", "Resuelta"),
    ]
    tipo = models.CharField(max_length=20, choices=TIPOS, db_index=True)
    nombre = models.CharField(max_length=150)
    email = models.EmailField()
    telefono = models.CharField(max_length=30, blank=True)
    numero_pedido = models.CharField(max_length=30, blank=True)
    mensaje = models.TextField(max_length=3000, blank=True)
    estado = models.CharField(max_length=12, choices=ESTADOS, default="pendiente", db_index=True)
    creado = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-creado"]
        verbose_name = "solicitud de atención"
        verbose_name_plural = "solicitudes de atención"

    def __str__(self):
        return f"{self.get_tipo_display()} #{self.pk} — {self.nombre}"


class ItemPedido(models.Model):
    pedido = models.ForeignKey(Pedido, related_name="items", on_delete=models.CASCADE)
    producto = models.ForeignKey(Producto, null=True, blank=True, on_delete=models.PROTECT)
    combo = models.ForeignKey(Combo, null=True, blank=True, on_delete=models.SET_NULL)
    nombre = models.CharField(max_length=200)
    sabor = models.CharField(max_length=100, blank=True)
    cantidad = models.PositiveIntegerField()
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    componentes_combo = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f"{self.cantidad} x {self.nombre}"


class VisitaDia(models.Model):
    """Page views per day and path. Aggregated, no personal data."""
    dia = models.DateField(db_index=True)
    ruta = models.CharField(max_length=200)
    vistas = models.PositiveIntegerField(default=0)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["dia", "ruta"], name="visita_unica_por_dia_y_ruta")]


class VisitanteDia(models.Model):
    """One row per visitor and day. The digest rotates daily and never stores the IP."""
    dia = models.DateField(db_index=True)
    huella = models.CharField(max_length=64)

    class Meta:
        constraints = [models.UniqueConstraint(fields=["dia", "huella"], name="visitante_unico_por_dia")]


class ConfiguracionJuego(models.Model):
    """Single row. Prize weights are relative (70/25/5 means 70%, 25%, 5%)."""
    activo = models.BooleanField(default=True)
    peso_5 = models.PositiveSmallIntegerField(default=70)
    peso_10 = models.PositiveSmallIntegerField(default=25)
    peso_envio = models.PositiveSmallIntegerField(default=5)
    dias_validez = models.PositiveSmallIntegerField(default=7)

    @classmethod
    def actual(cls):
        return cls.objects.get_or_create(pk=1)[0]


class Premio(models.Model):
    """A card-game prize. Free again if its order ends canceled or rejected."""
    TIPOS = [("porcentaje", "Descuento"), ("envio_gratis", "Envío gratis")]
    usuario = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="premios_juego")
    tipo = models.CharField(max_length=12, choices=TIPOS)
    porcentaje = models.PositiveSmallIntegerField(default=0)
    creado = models.DateTimeField(auto_now_add=True)
    vence = models.DateTimeField()
    pedido = models.ForeignKey("Pedido", null=True, blank=True, on_delete=models.SET_NULL, related_name="premios")

    @property
    def descripcion(self):
        return "Envío gratis" if self.tipo == "envio_gratis" else f"{self.porcentaje}% de descuento"

    def disponible(self, ahora):
        return self.vence > ahora and (self.pedido is None or self.pedido.estado in ("cancelado", "rechazado"))


class ConfiguracionTienda(models.Model):
    """Datos que el dueño edita desde el panel. Un campo vacío usa la variable de entorno equivalente."""
    pago_titular = models.CharField(max_length=150, blank=True)
    pago_alias = models.CharField(max_length=60, blank=True)
    pago_cvu = models.CharField(max_length=30, blank=True)
    envio_tarifas = models.CharField(max_length=300, blank=True, help_text="Hasta cuántos km y precio: 1:0,3:1000,5:2500")
    instrucciones_local = models.TextField(max_length=500, blank=True)
    instrucciones_efectivo_envio = models.TextField(max_length=500, blank=True)

    class Meta:
        verbose_name = "configuración de la tienda"

    @classmethod
    def actual(cls):
        return cls.objects.get_or_create(pk=1)[0]

    def valor(self, campo, variable, defecto=""):
        return getattr(self, campo).strip() or os.getenv(variable, defecto)
