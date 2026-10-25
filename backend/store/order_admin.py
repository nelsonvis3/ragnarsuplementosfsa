from django.contrib.admin.models import CHANGE, LogEntry
from django.db import transaction
from django.db.models import Q
from rest_framework import serializers, viewsets
from rest_framework.decorators import action
from rest_framework.pagination import PageNumberPagination
from rest_framework.response import Response

from .models import Pedido
from .order_summary import datos_articulos_pedido, nombre_pedido
from .orders import anular_venta_mostrador, completar_pedido_mercado_pago, expirar_reservas_vencidas, procesar_pedido_manual, resolver_revision_pago
from .permissions import AdministradorCatalogo


def acciones_pedido(pedido):
    if pedido.canal == "mostrador":
        return ["anular_mostrador"] if pedido.estado == "aprobado" else []
    if pedido.proveedor_pago in ("local", "transferencia") and pedido.estado in ("pendiente", "revisar_stock"):
        return ["aprobar", "cancelar"]
    if pedido.proveedor_pago == "mercado_pago":
        if pedido.estado == "revisar_stock":
            return ["completar_stock"] + (["cerrar_reembolsado"] if pedido.pago_id else [])
        if pedido.estado == "revision_pago":
            return (["consultar_pago"] if pedido.pago_id else []) + ["cerrar_sin_pago"] + (["cerrar_reembolsado"] if pedido.pago_id else [])
        if pedido.estado == "pendiente" and pedido.pago_id:
            return ["consultar_pago"]
    return []


class AdministradorPedidos(AdministradorCatalogo):
    message = "Solo el administrador de la tienda puede gestionar pedidos."


class PedidoAdminSerializer(serializers.ModelSerializer):
    nombre_pedido = serializers.SerializerMethodField()
    items = serializers.SerializerMethodField()
    estado_nombre = serializers.CharField(source="get_estado_display")
    medio_pago_nombre = serializers.CharField(source="get_proveedor_pago_display")
    entrega_nombre = serializers.CharField(source="get_forma_entrega_display")
    acciones = serializers.SerializerMethodField()
    total = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=False)
    costo_envio = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=False)
    descuento = serializers.DecimalField(max_digits=12, decimal_places=2, coerce_to_string=False)

    class Meta:
        model = Pedido
        fields = ("id", "nombre_pedido", "items", "nombre_comprador", "email_comprador", "telefono_comprador",
                  "estado", "estado_nombre", "proveedor_pago", "medio_pago_nombre", "forma_entrega", "entrega_nombre",
                  "direccion_entrega", "total", "costo_envio", "descuento", "stock_reservado", "stock_reservado_hasta", "canal",
                  "pago_id", "pagos_adicionales", "creado", "actualizado", "acciones")

    def get_nombre_pedido(self, obj):
        return nombre_pedido(obj)

    def get_items(self, obj):
        return datos_articulos_pedido(obj)

    def get_acciones(self, obj):
        return acciones_pedido(obj)


class FiltrosPedidos(serializers.Serializer):
    estado = serializers.ChoiceField(choices=["", *dict(Pedido.ESTADOS)], required=False, default="")
    buscar = serializers.CharField(max_length=150, required=False, allow_blank=True, default="")


class AccionPedidoSerializer(serializers.Serializer):
    accion = serializers.ChoiceField(choices=("aprobar", "cancelar", "completar_stock", "consultar_pago", "cerrar_sin_pago", "cerrar_reembolsado", "anular_mostrador"))
    actualizado = serializers.DateTimeField()
    verificado_proveedor = serializers.BooleanField(default=False)


class PaginacionPedidos(PageNumberPagination):
    page_size = 20


class PedidoAdminViewSet(viewsets.ReadOnlyModelViewSet):
    permission_classes = (AdministradorPedidos,)
    serializer_class = PedidoAdminSerializer
    pagination_class = PaginacionPedidos
    http_method_names = ("get", "post", "head", "options")
    queryset = Pedido.objects.prefetch_related("items").order_by("-creado", "-id")
    lookup_value_regex = r"[0-9]+"

    def get_object(self):
        serializers.IntegerField(min_value=1, max_value=9223372036854775807).run_validation(self.kwargs["pk"])
        return super().get_object()

    def finalize_response(self, request, response, *args, **kwargs):
        response = super().finalize_response(request, response, *args, **kwargs)
        response["Cache-Control"] = "no-store"
        return response

    def get_queryset(self):
        queryset = super().get_queryset()
        if self.action == "gestionar":
            return queryset.select_for_update()
        if self.action != "list":
            return queryset
        filtros = FiltrosPedidos(data=self.request.query_params)
        filtros.is_valid(raise_exception=True)
        estado, buscar = filtros.validated_data["estado"], filtros.validated_data["buscar"]
        if estado:
            queryset = queryset.filter(estado=estado)
        if buscar:
            condicion = (Q(nombre_comprador__icontains=buscar) | Q(email_comprador__icontains=buscar)
                         | Q(telefono_comprador__icontains=buscar) | Q(items__nombre__icontains=buscar))
            referencia = buscar.lstrip("#").strip()
            if referencia.isascii() and referencia.isdecimal() and len(referencia) <= 19 and int(referencia) <= 9223372036854775807:
                condicion |= Q(pk=int(referencia))
            queryset = queryset.filter(condicion).distinct()
        return queryset

    def list(self, request, *args, **kwargs):
        expirar_reservas_vencidas()
        return super().list(request, *args, **kwargs)

    @action(detail=True, methods=["post"], url_path="gestionar")
    def gestionar(self, request, pk=None):
        datos = AccionPedidoSerializer(data=request.data)
        datos.is_valid(raise_exception=True)
        accion = datos.validated_data["accion"]
        with transaction.atomic():
            # El cambio y su registro administrativo se confirman juntos.
            pedido = self.get_object()
            if pedido.actualizado != datos.validated_data["actualizado"]:
                return Response({"detail": "El pedido cambió desde que lo abriste. Actualizá la lista antes de continuar."}, status=409)
            if accion not in acciones_pedido(pedido):
                return Response({"detail": "Esta acción ya no está disponible para el estado del pedido."}, status=409)
            if accion.startswith("cerrar_") and not datos.validated_data["verificado_proveedor"]:
                return Response({"detail": "Confirmá que verificaste el estado y, si corresponde, la devolución en Mercado Pago."}, status=400)
            if accion in ("aprobar", "cancelar"):
                ok, mensaje = procesar_pedido_manual(pedido.pk, accion)
            elif accion == "anular_mostrador":
                ok, mensaje = anular_venta_mostrador(pedido.pk)
            elif accion == "completar_stock":
                ok, mensaje = completar_pedido_mercado_pago(pedido.pk)
            elif accion == "consultar_pago":
                from .views import procesar_notificacion_pago
                actualizado, _ = procesar_notificacion_pago(pedido.pago_id, pedido.pk)
                ok = actualizado is not None
                mensaje = "Estado consultado en Mercado Pago." if ok else "No pudimos verificar el pago. Intentá nuevamente."
            else:
                ok, mensaje = resolver_revision_pago(pedido.pk, "cancelado" if accion == "cerrar_sin_pago" else "reembolsado")
            pedido.refresh_from_db()
            LogEntry.objects.log_actions(user_id=request.user.pk, queryset=[pedido], action_flag=CHANGE,
                                         change_message=f"Gestión desde el panel: {accion}. Resultado: {mensaje}", single_object=True)
        return Response({"detail": mensaje, "pedido": self.get_serializer(pedido).data}, status=200 if ok else 409)
