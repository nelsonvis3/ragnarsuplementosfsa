from django.contrib import admin
from django.urls import path

from store import views

urlpatterns = [
    path("admin/", admin.site.urls),
    path("health/", views.health),
    path("auth/registro", views.registro),
    path("auth/login", views.login),
    path("auth/perfil", views.perfil),
    path("productos/", views.productos),
    path("productos/<slug:slug>/", views.producto_detalle),
    path("combos/", views.combos),
    path("combos/<slug:slug>/", views.combo_detalle),
    path("pagos/metodos", views.metodos_pago),
    path("envios/cotizar", views.cotizar_envio),
    path("pagos/crear-preferencia", views.crear_preferencia),
    path("pagos/webhook", views.webhook_mercado_pago),
    path("pagos/verificar-retorno", views.verificar_pago_retorno),
    path("atencion/solicitudes", views.crear_solicitud_atencion),
]
