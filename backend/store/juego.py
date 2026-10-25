"""Card game: server-drawn prizes for registered accounts, honoured at checkout.

Plays earned = 1 for having an account + 1 per approved order with 5 or more products
(each product inside a combo counts)."""
import secrets
from datetime import timedelta

from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from django.contrib.auth import get_user_model

from .models import ConfiguracionJuego, Pedido, Premio

PRODUCTOS_PARA_JUGADA = 5
from .permissions import AdministradorCatalogo


def premio_json(premio):
    if not premio:
        return None
    return {"tipo": premio.tipo, "porcentaje": premio.porcentaje, "descripcion": premio.descripcion,
            "vence": premio.vence, "disponible": premio.disponible(timezone.now())}


def jugadas_ganadas(usuario):
    compras = 0
    for pedido in Pedido.objects.filter(usuario=usuario, estado="aprobado").prefetch_related("items"):
        unidades = sum(i.cantidad * (len(i.componentes_combo) if i.combo_id else 1) for i in pedido.items.all())
        compras += unidades >= PRODUCTOS_PARA_JUGADA
    return 1 + compras


def premio_vigente(usuario, ahora=None):
    """The prize to show or spend: oldest available first, otherwise the latest one."""
    ahora = ahora or timezone.now()
    premios = list(Premio.objects.select_related("pedido").filter(usuario=usuario).order_by("vence"))
    return next((p for p in premios if p.disponible(ahora)), premios[-1] if premios else None)


def sortear(config):
    opciones = [("porcentaje", 5, config.peso_5), ("porcentaje", 10, config.peso_10), ("envio_gratis", 0, config.peso_envio)]
    total = sum(peso for *_, peso in opciones)
    tirada = secrets.randbelow(total)
    for tipo, porcentaje, peso in opciones:
        if tirada < peso:
            return tipo, porcentaje
        tirada -= peso
    raise AssertionError("weights exhausted")


@api_view(["GET"])
@permission_classes([AllowAny])
def estado_juego(request):
    config = ConfiguracionJuego.actual()
    user = request.user
    activo = config.activo and sum((config.peso_5, config.peso_10, config.peso_envio)) > 0
    if not user.is_authenticated:
        return Response({"activo": activo, "puede_jugar": False, "premio": None, "productos_para_jugada": PRODUCTOS_PARA_JUGADA})
    pendientes = jugadas_ganadas(user) - Premio.objects.filter(usuario=user).count()
    return Response({"activo": activo, "puede_jugar": activo and not user.is_superuser and pendientes > 0,
                     "premio": premio_json(premio_vigente(user)), "productos_para_jugada": PRODUCTOS_PARA_JUGADA})


@api_view(["POST"])
@permission_classes([IsAuthenticated])
def jugar(request):
    if request.user.is_superuser:
        return Response({"detail": "La cuenta administradora no participa del juego."}, status=403)
    config = ConfiguracionJuego.actual()
    with transaction.atomic():
        # Lock the account row so a double click cannot spend the same earned play twice.
        get_user_model().objects.select_for_update().get(pk=request.user.pk)
        if Premio.objects.filter(usuario=request.user).count() >= jugadas_ganadas(request.user):
            return Response({"premio": premio_json(premio_vigente(request.user)), "nuevo": False})
        if not config.activo or sum((config.peso_5, config.peso_10, config.peso_envio)) == 0:
            return Response({"detail": "El juego no está disponible en este momento."}, status=409)
        tipo, porcentaje = sortear(config)
        premio = Premio.objects.create(usuario=request.user, tipo=tipo, porcentaje=porcentaje,
                                       vence=timezone.now() + timedelta(days=config.dias_validez))
    return Response({"premio": premio_json(premio), "nuevo": True}, status=201)


class ConfiguracionJuegoSerializer(serializers.ModelSerializer):
    class Meta:
        model = ConfiguracionJuego
        fields = ("activo", "peso_5", "peso_10", "peso_envio", "dias_validez")

    def validate_dias_validez(self, valor):
        if not 1 <= valor <= 90:
            raise serializers.ValidationError("Elegí entre 1 y 90 días.")
        return valor

    def validate(self, datos):
        pesos = [datos.get(k, getattr(self.instance, k)) for k in ("peso_5", "peso_10", "peso_envio")]
        if datos.get("activo", self.instance.activo) and sum(pesos) == 0:
            raise serializers.ValidationError("Para activar el juego, al menos un premio tiene que tener probabilidad.")
        return datos


@api_view(["GET", "PATCH"])
@permission_classes([AdministradorCatalogo])
def configuracion_juego(request):
    config = ConfiguracionJuego.actual()
    if request.method == "PATCH":
        serializer = ConfiguracionJuegoSerializer(config, data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
    premios = Premio.objects.select_related("usuario", "pedido").order_by("-creado")[:50]
    ahora = timezone.now()
    return Response({**ConfiguracionJuegoSerializer(config).data, "premios": [
        {"usuario": p.usuario.email or p.usuario.username, "premio": p.descripcion, "creado": p.creado, "vence": p.vence,
         "estado": "Usado" if p.pedido and p.pedido.estado not in ("cancelado", "rechazado") else "Vencido" if p.vence <= ahora else "Disponible",
         "pedido": p.pedido_id} for p in premios]})
