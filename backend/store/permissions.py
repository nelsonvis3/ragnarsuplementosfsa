from rest_framework.permissions import BasePermission


def puede_administrar_catalogo(user):
    return bool(user.is_authenticated and user.is_active and user.is_superuser)


def puede_recuperar_contrasena(user):
    return bool(user.is_active and not user.is_superuser and not user.is_staff and user.has_usable_password())


class AdministradorCatalogo(BasePermission):
    message = "Solo los superusuarios de Django pueden administrar el catálogo."

    def has_permission(self, request, view):
        return puede_administrar_catalogo(request.user)
