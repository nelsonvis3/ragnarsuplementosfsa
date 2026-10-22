import hashlib
import logging
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import get_user_model
from django.core import signing
from django.core.cache import cache
from django.db import transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from .emails import enviar_bienvenida_registro
from .auth_payload import auth_payload
from .models import VerificacionEmail

logger = logging.getLogger(__name__)
SALT_CONFIRMACION = "ragnar.confirmar-email"
ENLACE_INVALIDO = {"detail": "El enlace no es válido, ya fue usado o venció. Si todavía no confirmaste tu email, solicitá uno nuevo."}
RESPUESTA_REENVIO = {"detail": "Si el email tiene una confirmación pendiente, recibirás un nuevo enlace. Revisá también el correo no deseado y esperá un minuto entre solicitudes."}


def crear_token_confirmacion(verificacion):
    return signing.dumps({"uid": verificacion.usuario_id, "email": verificacion.email, "codigo": str(verificacion.codigo)}, salt=SALT_CONFIRMACION, compress=True)


def enviar_enlace_confirmacion(verificacion):
    clave = "confirmacion-email:" + hashlib.sha256(verificacion.email.casefold().encode()).hexdigest()
    if not cache.add(clave, True, timeout=60):
        return False
    enlace = f"{settings.EMAIL_CONFIRMATION_FRONTEND_URL}/confirmar-email#{urlencode({'token': crear_token_confirmacion(verificacion)})}"
    try:
        enviar_bienvenida_registro(verificacion.usuario, enlace)
        return settings.EMAIL_BACKEND != "django.core.mail.backends.console.EmailBackend"
    except Exception:
        cache.delete(clave)
        logger.warning("No se pudo enviar un correo de confirmación de registro.")
        return False


class ConfirmacionThrottle(AnonRateThrottle):
    scope = "confirmar_email"


class ReenvioThrottle(AnonRateThrottle):
    scope = "reenviar_confirmacion"


class TokenSerializer(serializers.Serializer):
    token = serializers.CharField(max_length=2048)


class ReenvioSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([ConfirmacionThrottle])
def confirmar_email(request):
    serializer = TokenSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    try:
        datos = signing.loads(serializer.validated_data["token"], salt=SALT_CONFIRMACION, max_age=settings.EMAIL_CONFIRMATION_TIMEOUT)
        if not isinstance(datos, dict) or not isinstance(datos.get("uid"), int) or not 0 < datos["uid"] <= 9223372036854775807:
            return Response(ENLACE_INVALIDO, status=400)
    except (signing.BadSignature, ValueError, TypeError):
        return Response(ENLACE_INVALIDO, status=400)
    with transaction.atomic():
        # Los cambios de rol y la activación se sincronizan con la misma fila de usuario.
        user = get_user_model().objects.select_for_update().filter(pk=datos["uid"]).first()
        verificacion = VerificacionEmail.objects.select_for_update().filter(usuario_id=datos["uid"]).first()
        if (
            not user or not verificacion or verificacion.confirmado_en
            or user.is_active or user.is_staff or user.is_superuser
            or datos.get("codigo") != str(verificacion.codigo)
            or datos.get("email") != verificacion.email
            or user.email.casefold() != verificacion.email.casefold()
        ):
            return Response(ENLACE_INVALIDO, status=400)
        verificacion.confirmado_en = timezone.now()
        verificacion.save(update_fields=["confirmado_en"])
        user.is_active = True
        user.save(update_fields=["is_active"])
        sesion = auth_payload(user)
    return Response({"detail": "¡Email confirmado! Tu sesión ya está iniciada. Bienvenido/a a Ragnar.", **sesion}, headers={"Cache-Control": "no-store"})


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([ReenvioThrottle])
def reenviar_confirmacion(request):
    serializer = ReenvioSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data["email"].lower()
    usuarios = list(get_user_model().objects.filter(email__iexact=email)[:2])
    if len(usuarios) == 1:
        user = usuarios[0]
        if not user.is_active and not user.is_staff and not user.is_superuser and user.has_usable_password():
            verificacion = VerificacionEmail.objects.select_related("usuario").filter(usuario=user, email__iexact=user.email, confirmado_en__isnull=True).first()
            if verificacion:
                enviar_enlace_confirmacion(verificacion)
    return Response(RESPUESTA_REENVIO)
