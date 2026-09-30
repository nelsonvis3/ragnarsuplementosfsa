from django.contrib import admin, messages

from .models import Combo, ItemPedido, Pedido, Producto, SolicitudAtencion
from .orders import procesar_pedido_manual


admin.site.site_header = "Administración de Ragnar Suplementos"
admin.site.site_title = "Ragnar | Administración"
admin.site.index_title = "Gestión de la tienda"


@admin.register(Producto)
class ProductoAdmin(admin.ModelAdmin):
    list_display = ("nombre", "categoria", "precio", "stock", "activo", "actualizado")
    list_editable = ("precio", "stock", "activo")
    list_filter = ("categoria", "activo")
    search_fields = ("nombre", "slug")
    prepopulated_fields = {"slug": ("nombre",)}
    list_per_page = 25
    readonly_fields = ("creado", "actualizado")
    fieldsets = (
        ("Información del producto", {"fields": ("nombre", "slug", "categoria", "descripcion")}),
        ("Precio e inventario", {"fields": ("precio", "stock", "activo")}),
        ("Imagen y sabores", {"fields": ("imagen_archivo", "imagen", "sabores")}),
        ("Fechas", {"fields": ("creado", "actualizado"), "classes": ("collapse",)}),
    )

    def formfield_for_dbfield(self, db_field, request, **kwargs):
        formfield = super().formfield_for_dbfield(db_field, request, **kwargs)
        if db_field.name == "imagen" and formfield:
            formfield.help_text = (
                "Campo de compatibilidad para los productos cargados anteriormente. "
                "Para las imágenes nuevas, usá el campo de imagen subida."
            )
        return formfield


@admin.register(Combo)
class ComboAdmin(admin.ModelAdmin):
    list_display = ("nombre", "precio", "activo")
    list_editable = ("precio", "activo")
    list_filter = ("activo",)
    search_fields = ("nombre", "slug")
    filter_horizontal = ("productos",)
    prepopulated_fields = {"slug": ("nombre",)}
    list_per_page = 25
    readonly_fields = ("creado", "actualizado")
    fieldsets = (
        ("Información del combo", {"fields": ("nombre", "slug", "descripcion")}),
        ("Precio y productos", {"fields": ("precio", "productos", "activo")}),
        ("Imagen", {"fields": ("imagen_archivo", "imagen")}),
        ("Fechas", {"fields": ("creado", "actualizado"), "classes": ("collapse",)}),
    )

    def formfield_for_dbfield(self, db_field, request, **kwargs):
        formfield = super().formfield_for_dbfield(db_field, request, **kwargs)
        if db_field.name == "imagen" and formfield:
            formfield.help_text = (
                "Campo de compatibilidad para los combos cargados anteriormente. "
                "Para las imágenes nuevas, usá el campo de imagen subida."
            )
        return formfield


class ItemPedidoInline(admin.TabularInline):
    model = ItemPedido
    extra = 0
    readonly_fields = ("producto", "combo", "nombre", "sabor", "cantidad", "precio_unitario", "componentes_combo")

    def has_add_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Pedido)
class PedidoAdmin(admin.ModelAdmin):
    list_display = ("id", "nombre_comprador", "telefono_comprador", "email_comprador", "total", "forma_entrega", "estado", "stock_reservado", "stock_reservado_hasta", "creado")
    list_filter = ("estado", "proveedor_pago", "creado")
    search_fields = ("nombre_comprador", "telefono_comprador", "email_comprador", "pago_id", "preferencia_id")
    readonly_fields = (
        "estado", "stock_reservado", "stock_reservado_hasta", "nombre_comprador", "telefono_comprador", "email_comprador", "total", "costo_envio", "distancia_envio_km",
        "direccion_entrega", "forma_entrega", "preferencia_id", "pago_id", "creado", "actualizado",
    )
    inlines = (ItemPedidoInline,)
    actions = ("confirmar_pago_manual", "cancelar_pedido_manual")

    @admin.action(description="Marcar pago manual como recibido y completar pedido")
    def confirmar_pago_manual(self, request, queryset):
        completados = 0
        for pedido in queryset:
            ok, mensaje = procesar_pedido_manual(pedido.pk, "aprobar")
            if ok:
                completados += 1
            else:
                self.message_user(request, f"Pedido #{pedido.pk}: {mensaje}", level=messages.WARNING)
        if completados:
            self.message_user(
                request,
                f"Se completaron {completados} pedido(s). Si SMTP está activo, se envió el correo de pago confirmado.",
                level=messages.SUCCESS,
            )

    @admin.action(description="Cancelar pedido manual y liberar stock reservado")
    def cancelar_pedido_manual(self, request, queryset):
        cancelados = 0
        for pedido in queryset:
            ok, mensaje = procesar_pedido_manual(pedido.pk, "cancelar")
            if ok:
                cancelados += 1
            else:
                self.message_user(request, f"Pedido #{pedido.pk}: {mensaje}", level=messages.WARNING)
        if cancelados:
            self.message_user(request, f"Se cancelaron {cancelados} pedido(s).", level=messages.SUCCESS)


@admin.register(SolicitudAtencion)
class SolicitudAtencionAdmin(admin.ModelAdmin):
    list_display = ("id", "tipo", "nombre", "email", "numero_pedido", "estado", "creado")
    list_filter = ("tipo", "estado", "creado")
    search_fields = ("nombre", "email", "telefono", "numero_pedido", "mensaje")
    readonly_fields = ("tipo", "nombre", "email", "telefono", "numero_pedido", "mensaje", "creado")
