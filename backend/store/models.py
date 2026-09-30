from django.conf import settings
from django.db import models
from cloudinary.models import CloudinaryField


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
        stocks = list(self.productos.filter(activo=True).values_list("stock", flat=True))
        return min(stocks) if stocks else 0


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
    preferencia_id = models.CharField(max_length=120, blank=True)
    pago_id = models.CharField(max_length=120, blank=True, unique=True, null=True)
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
    producto = models.ForeignKey(Producto, null=True, blank=True, on_delete=models.SET_NULL)
    combo = models.ForeignKey(Combo, null=True, blank=True, on_delete=models.SET_NULL)
    nombre = models.CharField(max_length=200)
    sabor = models.CharField(max_length=100, blank=True)
    cantidad = models.PositiveIntegerField()
    precio_unitario = models.DecimalField(max_digits=12, decimal_places=2)
    componentes_combo = models.JSONField(default=list, blank=True)

    def __str__(self):
        return f"{self.cantidad} x {self.nombre}"
