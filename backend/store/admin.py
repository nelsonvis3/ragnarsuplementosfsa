from django.contrib import admin, messages
from django import forms
from django.db import transaction

from .models import Categoria, Combo, ItemPedido, Pedido, Producto, SolicitudAtencion, VerificacionEmail
from .catalog_admin import CategoriaAdminSerializer
from .orders import completar_pedido_mercado_pago, procesar_pedido_manual, resolver_revision_pago
from .views import procesar_notificacion_pago


admin.site.site_header = "Administración de Ragnar Suplementos"
admin.site.site_title = "Ragnar | Administración"
admin.site.index_title = "Gestión de la tienda"


class CategoriaForm(forms.ModelForm):
    class Meta:
        model = Categoria
        fields = ("nombre",)

    def clean_nombre(self):
        from rest_framework.exceptions import ValidationError
        try:
            return CategoriaAdminSerializer().validate_nombre(self.cleaned_data["nombre"])
        except ValidationError as exc:
            raise forms.ValidationError(exc.detail)

    def save(self, commit=True):
        from django.utils.text import slugify
        self.instance.slug = slugify(self.cleaned_data["nombre"])[:80]
        return super().save(commit=commit)


@admin.register(Categoria)
class CategoriaAdmin(admin.ModelAdmin):
    form = CategoriaForm
    list_display = ("nombre", "slug")

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


class HistorialProtegidoAdmin(admin.ModelAdmin):
    def has_delete_permission(self, request, obj=None):
        return False


class ProductoInventarioForm(forms.ModelForm):
    stock_anterior = forms.IntegerField(widget=forms.HiddenInput, required=False)

    class Meta:
        model = Producto
        fields = "__all__"

    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        if self.instance.pk and "stock_anterior" in self.fields:
            self.fields["stock_anterior"].initial = self.instance.stock

    def clean(self):
        datos = super().clean()
        if self.instance.pk and "stock" in datos:
            # changeform_view mantiene una transacción durante validación y guardado.
            with transaction.atomic():
                actual = Producto.objects.select_for_update().get(pk=self.instance.pk)
                if datos.get("stock_anterior") != actual.stock:
                    raise forms.ValidationError("El stock cambió desde que abriste el formulario. Recargá la página y revisá las unidades antes de guardar.")
        return datos


@admin.register(VerificacionEmail)
class VerificacionEmailAdmin(admin.ModelAdmin):
    list_display = ("email", "usuario", "creado", "confirmado_en")
    list_filter = ("confirmado_en",)
    search_fields = ("email", "usuario__username")
    readonly_fields = ("usuario", "email", "codigo", "creado", "confirmado_en")

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Producto)
class ProductoAdmin(HistorialProtegidoAdmin):
    form = ProductoInventarioForm
    list_display = ("nombre", "categoria", "precio", "stock", "activo", "actualizado")
    list_editable = ("precio", "activo")
    list_filter = ("categoria", "activo")
    search_fields = ("nombre", "slug")
    prepopulated_fields = {"slug": ("nombre",)}
    list_per_page = 25
    readonly_fields = ("creado", "actualizado")
    fieldsets = (
        ("Información del producto", {"fields": ("nombre", "slug", "categoria", "descripcion")}),
        ("Precio e inventario", {"fields": ("precio", "stock", "stock_anterior", "activo")}),
        ("Imagen y sabores", {"fields": ("imagen_archivo", "imagen", "sabores")}),
        ("Fechas", {"fields": ("creado", "actualizado"), "classes": ("collapse",)}),
    )

    def save_model(self, request, obj, form, change):
        if not change:
            return super().save_model(request, obj, form, change)
        # El listado editable no debe reescribir stock leído antes de una compra.
        campos = {field.name for field in obj._meta.concrete_fields}
        modificados = [campo for campo in form.changed_data if campo in campos]
        if modificados:
            with transaction.atomic():
                Producto.objects.select_for_update().get(pk=obj.pk)
                obj.save(update_fields=[*modificados, "actualizado"])

    def formfield_for_dbfield(self, db_field, request, **kwargs):
        if db_field.name == "categoria":
            return forms.ChoiceField(choices=list(Categoria.objects.values_list("slug", "nombre")), label="Categoría")
        formfield = super().formfield_for_dbfield(db_field, request, **kwargs)
        if db_field.name == "imagen" and formfield:
            formfield.help_text = (
                "Campo de compatibilidad para los productos cargados anteriormente. "
                "Para las imágenes nuevas, usá el campo de imagen subida."
            )
        return formfield


@admin.register(Combo)
class ComboAdmin(HistorialProtegidoAdmin):
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
class PedidoAdmin(HistorialProtegidoAdmin):
    list_display = ("id", "nombre_comprador", "telefono_comprador", "email_comprador", "total", "forma_entrega", "estado", "stock_reservado", "stock_reservado_hasta", "creado")
    list_filter = ("estado", "proveedor_pago", "creado")
    search_fields = ("nombre_comprador", "telefono_comprador", "email_comprador", "pago_id", "preferencia_id")
    readonly_fields = (
        "usuario", "proveedor_pago", "checkout_key", "checkout_payload_hash", "preferencia_url",
        "estado", "stock_reservado", "stock_reservado_hasta", "nombre_comprador", "telefono_comprador", "email_comprador", "total", "costo_envio", "distancia_envio_km",
        "direccion_entrega", "forma_entrega", "preferencia_id", "pago_id", "pagos_adicionales", "creado", "actualizado",
    )
    inlines = (ItemPedidoInline,)
    actions = (
        "confirmar_pago_manual",
        "cancelar_pedido_manual",
        "completar_mercado_pago_revisar_stock",
        "reconciliar_revision_pago",
        "cerrar_revision_sin_pago",
        "cerrar_revision_reembolsado",
    )

    def has_add_permission(self, request):
        return False

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

    @admin.action(description="Completar pedido de Mercado Pago tras reponer stock")
    def completar_mercado_pago_revisar_stock(self, request, queryset):
        completados = 0
        for pedido in queryset:
            ok, mensaje = completar_pedido_mercado_pago(pedido.pk)
            if ok:
                completados += 1
            else:
                self.message_user(request, f"Pedido #{pedido.pk}: {mensaje}", level=messages.WARNING)
        if completados:
            self.message_user(
                request,
                f"Se completaron {completados} pedido(s) pagados y se descontó el inventario.",
                level=messages.SUCCESS,
            )

    @admin.action(description="Consultar en Mercado Pago los pedidos en revisión")
    def reconciliar_revision_pago(self, request, queryset):
        for pedido in queryset.filter(proveedor_pago="mercado_pago", estado="revision_pago"):
            if not pedido.pago_id:
                self.message_user(request, f"Pedido #{pedido.pk}: no tiene ID de pago; buscá el pedido en Mercado Pago.", level=messages.WARNING)
                continue
            actualizado, resultado = procesar_notificacion_pago(pedido.pago_id, pedido.pk)
            if actualizado:
                self.message_user(request, f"Pedido #{pedido.pk}: estado actual {actualizado.get_estado_display().lower()}.", level=messages.INFO)
            else:
                self.message_user(request, f"Pedido #{pedido.pk}: no se pudo reconciliar ({resultado}).", level=messages.WARNING)

    @admin.action(description="Cerrar revisión sin pago (verificá primero en Mercado Pago)")
    def cerrar_revision_sin_pago(self, request, queryset):
        self._cerrar_revision(request, queryset, "cancelado")

    @admin.action(description="Marcar revisión reembolsada (confirmá primero la devolución)")
    def cerrar_revision_reembolsado(self, request, queryset):
        self._cerrar_revision(
            request,
            queryset.filter(estado__in=("revision_pago", "revisar_stock")),
            "reembolsado",
        )

    def _cerrar_revision(self, request, queryset, estado_final):
        estados = ("revision_pago", "revisar_stock") if estado_final == "reembolsado" else ("revision_pago",)
        for pedido in queryset.filter(proveedor_pago="mercado_pago", estado__in=estados):
            ok, mensaje = resolver_revision_pago(pedido.pk, estado_final)
            if ok:
                actualizado = Pedido.objects.get(pk=pedido.pk)
                self.log_change(request, actualizado, f"Revisión Mercado Pago cerrada como {estado_final} tras verificación manual.")
                self.message_user(request, f"Pedido #{pedido.pk}: {mensaje}", level=messages.SUCCESS)
            else:
                self.message_user(request, f"Pedido #{pedido.pk}: {mensaje}", level=messages.WARNING)


@admin.register(SolicitudAtencion)
class SolicitudAtencionAdmin(admin.ModelAdmin):
    list_display = ("id", "tipo", "nombre", "email", "numero_pedido", "estado", "creado")
    list_filter = ("tipo", "estado", "creado")
    search_fields = ("nombre", "email", "telefono", "numero_pedido", "mensaje")
    readonly_fields = ("tipo", "nombre", "email", "telefono", "numero_pedido", "mensaje", "creado")
