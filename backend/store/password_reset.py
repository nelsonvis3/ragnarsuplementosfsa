import hashlib
import logging
from urllib.parse import urlencode

from django.conf import settings
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password
from django.contrib.auth.tokens import default_token_generator
from django.core.cache import cache
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from django.utils.encoding import force_bytes
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from rest_framework import serializers
from rest_framework.decorators import api_view, authentication_classes, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from .emails import enviar_recuperacion_contrasena
from .permissions import puede_recuperar_contrasena

logger = logging.getLogger(__name__)
RESPUESTA_RECUPERACION = {
    "detail": "Si el email corresponde a una cuenta con recuperación habilitada, recibirás un enlace para cambiar tu contraseña. Revisá también el correo no deseado."
}
ENLACE_INVALIDO = {"detail": "El enlace no es válido o ya venció. Solicitá uno nuevo."}


class RecuperacionThrottle(AnonRateThrottle):
    scope = "recuperar_contrasena"


class RestablecimientoThrottle(AnonRateThrottle):
    scope = "restablecer_contrasena"


class RecuperacionSerializer(serializers.Serializer):
    email = serializers.EmailField(max_length=254)


class RestablecimientoSerializer(serializers.Serializer):
    uid = serializers.CharField(max_length=128)
    token = serializers.CharField(max_length=128)
    password = serializers.CharField(max_length=128, trim_whitespace=False, write_only=True)
    password_confirmacion = serializers.CharField(max_length=128, trim_whitespace=False, write_only=True)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([RecuperacionThrottle])
def recuperar_contrasena(request):
    serializer = RecuperacionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    email = serializer.validated_data["email"].lower()
    # Evita múltiples envíos al mismo correo, incluso desde distintas IP.
    clave = "recuperacion:" + hashlib.sha256(email.encode()).hexdigest()
    if not cache.add(clave, True, timeout=60):
        return Response(RESPUESTA_RECUPERACION)
    usuarios = list(get_user_model().objects.filter(email__iexact=email)[:2])
    if len(usuarios) == 1 and puede_recuperar_contrasena(usuarios[0]):
        user = usuarios[0]
        uid = urlsafe_base64_encode(force_bytes(user.pk))
        token = default_token_generator.make_token(user)
        # El fragmento no viaja a los logs HTTP ni al Referer de otros recursos.
        enlace = f"{settings.PASSWORD_RESET_FRONTEND_URL}/restablecer-contrasena#{urlencode({'uid': uid, 'token': token})}"
        try:
            enviar_recuperacion_contrasena(user, enlace)
        except Exception:
            # No publicar emails, tokens ni respuestas del proveedor en logs.
            logger.warning("No se pudo enviar un correo de recuperación de contraseña.")
    return Response(RESPUESTA_RECUPERACION)


@api_view(["POST"])
@authentication_classes([])
@permission_classes([AllowAny])
@throttle_classes([RestablecimientoThrottle])
def restablecer_contrasena(request):
    serializer = RestablecimientoSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    datos = serializer.validated_data
    try:
        user_id = urlsafe_base64_decode(datos["uid"]).decode()
        if not user_id.isdecimal() or len(user_id) > 19 or int(user_id) > 9223372036854775807:
            return Response(ENLACE_INVALIDO, status=400)
    except (ValueError, UnicodeDecodeError, OverflowError):
        return Response(ENLACE_INVALIDO, status=400)
    with transaction.atomic():
        user = get_user_model().objects.select_for_update().filter(pk=user_id).first()
        if not user or not puede_recuperar_contrasena(user) or not default_token_generator.check_token(user, datos["token"]):
            return Response(ENLACE_INVALIDO, status=400)
        if datos["password"] != datos["password_confirmacion"]:
            return Response({"detail": "Las contraseñas no coinciden."}, status=400)
        try:
            validate_password(datos["password"], user)
        except DjangoValidationError as exc:
            return Response({"detail": " ".join(exc.messages)}, status=400)
        user.set_password(datos["password"])
        user.save(update_fields=["password"])
    return Response({"detail": "Tu contraseña fue actualizada. Volvé a iniciar sesión."})
