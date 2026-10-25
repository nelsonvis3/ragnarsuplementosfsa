"""Owner panel: daily visits, dashboard numbers and customer-service requests."""
import hashlib
import hmac
import re
from datetime import timedelta
from decimal import Decimal

from django.conf import settings
from django.db import IntegrityError, transaction
from django.contrib.auth import get_user_model
from django.db.models import Count, F, Max, Q, Sum
from django.db.models.functions import TruncDate
from django.utils import timezone
from rest_framework import mixins, serializers, viewsets
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import SimpleRateThrottle

from .models import Combo, ConfiguracionTienda, ItemPedido, Pedido, Producto, SolicitudAtencion, VisitaDia, VisitanteDia
from .permissions import AdministradorCatalogo
from .shipping import ErrorCotizacionEnvio, parsear_tarifas
from .views import ItemCompraSerializer, agregar_items_y_descontar_stock

BOT = re.compile(r"bot|crawl|spider|slurp|preview|headless|lighthouse", re.I)
POR_REVISAR = ("pendiente", "revisar_stock", "revision_pago")


class VisitaThrottle(SimpleRateThrottle):
    scope = "visita"

    def get_cache_key(self, request, view):
        return self.cache_format % {"scope": self.scope, "ident": self.get_ident(request)}


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([VisitaThrottle])
def registrar_visita(request):
    ruta = str(request.data.get("ruta", ""))[:200]
    agente = request.META.get("HTTP_USER_AGENT", "")
    if not re.fullmatch(r"/[a-zA-Z0-9/_.-]*", ruta) or ruta.startswith("/administracion") or BOT.search(agente):
        return Response(status=204)
    dia = timezone.localdate()
    with transaction.atomic():
        fila, _ = VisitaDia.objects.select_for_update().get_or_create(dia=dia, ruta=ruta)
        fila.vistas = F("vistas") + 1
        fila.save(update_fields=["vistas"])
    huella = hmac.new(settings.SECRET_KEY.encode(), f"{dia}:{request.META.get('REMOTE_ADDR', '')}:{agente[:200]}".encode(), hashlib.sha256).hexdigest()
    try:
        with transaction.atomic():
            VisitanteDia.objects.get_or_create(dia=dia, huella=huella)
    except IntegrityError:
        pass
    return Response(status=204)


@api_view(["GET"])
@permission_classes([AdministradorCatalogo])
def resumen(request):
    try:
        dias = min(max(int(request.query_params.get("dias", 30)), 1), 365)
    except ValueError:
        dias = 30
    hoy = timezone.localdate()
    desde = hoy - timedelta(days=dias - 1)
    aprobados = Pedido.objects.filter(estado="aprobado", creado__date__gte=desde)
    total = aprobados.aggregate(t=Sum("total"))["t"] or Decimal("0")
    ventas = aprobados.count()
    visitas = VisitaDia.objects.filter(dia__gte=desde)
    visitantes = VisitanteDia.objects.filter(dia__gte=desde)
    por_dia_ventas = {r["d"]: r for r in aprobados.annotate(d=TruncDate("creado")).values("d").annotate(total=Sum("total"), pedidos=Count("id"))}
    por_dia_visitantes = dict(visitantes.values("dia").annotate(n=Count("id")).values_list("dia", "n"))
    serie = [{"dia": d, "total": float(por_dia_ventas.get(d, {}).get("total") or 0), "pedidos": por_dia_ventas.get(d, {}).get("pedidos", 0), "visitantes": por_dia_visitantes.get(d, 0)}
             for d in (desde + timedelta(days=n) for n in range(dias))]
    mas_vendidos = ItemPedido.objects.filter(pedido__in=aprobados).values("nombre").annotate(unidades=Sum("cantidad")).order_by("-unidades")[:8]
    cantidad_visitantes = visitantes.count()
    return Response({
        "dias": dias,
        "ventas": ventas,
        "cobrado": float(total),
        "ticket_promedio": float(total / ventas) if ventas else 0,
        "por_revisar": Pedido.objects.filter(estado__in=POR_REVISAR).count(),
        "visitantes": cantidad_visitantes,
        "vistas": visitas.aggregate(t=Sum("vistas"))["t"] or 0,
        "conversion": round(ventas / cantidad_visitantes * 100, 2) if cantidad_visitantes else 0,
        "serie": serie,
        "mas_vendidos": list(mas_vendidos),
        "medios_pago": [{"medio": dict(Pedido.MEDIOS_PAGO)[r["proveedor_pago"]], "pedidos": r["n"]} for r in aprobados.values("proveedor_pago").annotate(n=Count("id")).order_by("-n")],
        "paginas": list(visitas.values("ruta").annotate(vistas=Sum("vistas")).order_by("-vistas")[:8]),
        "sin_stock": [{"id": p.pk, "nombre": p.nombre} for p in Producto.objects.filter(activo=True, stock=0)[:12]],
        "stock_bajo": [{"id": p.pk, "nombre": p.nombre, "stock": p.stock} for p in Producto.objects.filter(activo=True, stock__gt=0, stock__lte=3).order_by("stock")[:12]],
        "combos_publicados": Combo.objects.filter(activo=True).count(),
        "consultas_pendientes": SolicitudAtencion.objects.filter(estado="pendiente").count(),
        "ultimos": [{"id": p.pk, "comprador": p.nombre_comprador, "total": float(p.total), "estado": p.get_estado_display(), "codigo_estado": p.estado, "creado": p.creado}
                    for p in Pedido.objects.order_by("-creado")[:6]],
    })


class SolicitudSerializer(serializers.ModelSerializer):
    tipo_nombre = serializers.CharField(source="get_tipo_display", read_only=True)

    class Meta:
        model = SolicitudAtencion
        fields = ("id", "tipo", "tipo_nombre", "nombre", "email", "telefono", "numero_pedido", "mensaje", "estado", "creado")
        read_only_fields = ("id", "tipo", "tipo_nombre", "nombre", "email", "telefono", "numero_pedido", "mensaje", "creado")


class SolicitudAdminViewSet(mixins.ListModelMixin, mixins.UpdateModelMixin, viewsets.GenericViewSet):
    permission_classes = [AdministradorCatalogo]
    serializer_class = SolicitudSerializer
    http_method_names = ["get", "patch"]

    def get_queryset(self):
        filas = SolicitudAtencion.objects.all()
        estado = self.request.query_params.get("estado")
        return filas.filter(estado=estado) if estado in dict(SolicitudAtencion.ESTADOS) else filas


ALIAS = re.compile(r"^[a-zA-Z0-9.-]{6,20}$")


class ConfiguracionTiendaSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracionTienda
        fields = ("pago_titular", "pago_alias", "pago_cvu", "envio_tarifas", "instrucciones_local", "instrucciones_efectivo_envio")

    def validate_pago_alias(self, valor):
        valor = valor.strip()
        if valor and not ALIAS.match(valor):
            raise serializers.ValidationError("El alias tiene entre 6 y 20 caracteres: letras, números, puntos o guiones.")
        return valor

    def validate_pago_cvu(self, valor):
        valor = valor.strip().replace(" ", "")
        if valor and not (valor.isdigit() and len(valor) == 22):
            raise serializers.ValidationError("El CVU tiene 22 números.")
        return valor

    def validate_envio_tarifas(self, valor):
        valor = valor.strip()
        if valor:
            try:
                parsear_tarifas(valor)
            except ErrorCotizacionEnvio:
                raise serializers.ValidationError("Usá el formato km:precio separado por comas, por ejemplo 1:0,3:1000,5:2500.")
        return valor


@api_view(["GET", "PATCH"])
@permission_classes([AdministradorCatalogo])
def configuracion_tienda(request):
    """Datos de pago y envío. Un campo vacío vuelve al valor del .env; `vigente` muestra lo que se usa hoy."""
    config = ConfiguracionTienda.actual()
    if request.method == "PATCH":
        serializer = ConfiguracionTiendaSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
    vigente = {
        "pago_titular": config.valor("pago_titular", "PAGO_TITULAR"),
        "pago_alias": config.valor("pago_alias", "PAGO_ALIAS"),
        "pago_cvu": config.valor("pago_cvu", "PAGO_CVU"),
        "envio_tarifas": config.valor("envio_tarifas", "ENVIO_TARIFAS_KM_ARS", "1:0,3:1000,5:2500,8:3500,12:5000"),
        "instrucciones_local": config.valor("instrucciones_local", "LOCAL_INSTRUCCIONES"),
        "instrucciones_efectivo_envio": config.valor("instrucciones_efectivo_envio", "ENVIO_PAGO_EFECTIVO_INSTRUCCIONES"),
    }
    return Response({**ConfiguracionTiendaSerializer(config).data, "vigente": vigente})


@api_view(["GET"])
@permission_classes([AdministradorCatalogo])
def clientes(request):
    """Cuentas de clientes (sin administradores) con sus compras aprobadas. Solo lectura."""
    aprobado = Q(pedido__estado="aprobado")
    filas = get_user_model().objects.filter(is_superuser=False)
    busqueda = request.query_params.get("q", "").strip()[:100]
    if busqueda:
        filas = filas.filter(Q(email__icontains=busqueda) | Q(first_name__icontains=busqueda) | Q(last_name__icontains=busqueda))
    filas = filas.annotate(compras=Count("pedido", filter=aprobado), gastado=Sum("pedido__total", filter=aprobado),
                           ultima_compra=Max("pedido__creado", filter=aprobado)).order_by("-date_joined")[:200]
    return Response([{"id": u.pk, "nombre": u.get_full_name() or u.first_name or u.username, "email": u.email,
                      "alta": u.date_joined, "email_confirmado": u.is_active, "compras": u.compras,
                      "gastado": float(u.gastado or 0), "ultima_compra": u.ultima_compra} for u in filas])


class VentaMostradorSerializer(serializers.Serializer):
    venta_key = serializers.UUIDField()
    items = ItemCompraSerializer(many=True, allow_empty=False, max_length=50)
    medio_pago = serializers.ChoiceField(choices=(("local", "Efectivo"), ("transferencia", "Transferencia")))
    nombre_comprador = serializers.CharField(max_length=150, required=False, allow_blank=True)
    telefono_comprador = serializers.CharField(max_length=30, required=False, allow_blank=True)


@api_view(["POST"])
@permission_classes([AdministradorCatalogo])
def venta_mostrador(request):
    """Venta cobrada en el local: descuenta stock con los mismos bloqueos que el checkout y queda aprobada."""
    serializer = VentaMostradorSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    datos = serializer.validated_data
    existente = Pedido.objects.filter(checkout_key=datos["venta_key"]).first()
    if existente:
        return Response({"pedido_id": existente.pk, "total": float(existente.total)})
    try:
        with transaction.atomic():
            pedido = Pedido.objects.create(
                canal="mostrador", estado="aprobado", proveedor_pago=datos["medio_pago"], total=0,
                nombre_comprador=datos.get("nombre_comprador", "").strip() or "Venta en mostrador",
                telefono_comprador=datos.get("telefono_comprador", "").strip(), email_comprador="",
                checkout_key=datos["venta_key"],
            )
            total, _ = agregar_items_y_descontar_stock(pedido, datos["items"])
            pedido.total = total
            pedido.save(update_fields=["total"])
    except (Producto.DoesNotExist, Combo.DoesNotExist):
        return Response({"detail": "Uno de los productos o combos ya no está disponible."}, status=400)
    except serializers.ValidationError as exc:
        return Response(exc.detail, status=400)
    except IntegrityError:
        existente = Pedido.objects.filter(checkout_key=datos["venta_key"]).first()
        if not existente:
            raise
        pedido = existente
    return Response({"pedido_id": pedido.pk, "total": float(pedido.total)}, status=201)
