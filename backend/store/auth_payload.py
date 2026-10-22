"""Respuesta de sesión compartida por login y confirmación de email."""
from rest_framework_simplejwt.tokens import RefreshToken

from .permissions import puede_administrar_catalogo, puede_recuperar_contrasena


def usuario_json(user):
    return {
        "id": user.id,
        "nombre_completo": user.first_name or user.get_username(),
        "email": user.email,
        "puede_administrar_catalogo": puede_administrar_catalogo(user),
        "puede_recuperar_contrasena": puede_recuperar_contrasena(user),
    }


def auth_payload(user):
    return {"token": str(RefreshToken.for_user(user).access_token), "usuario": usuario_json(user)}
