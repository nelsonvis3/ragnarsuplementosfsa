import hashlib
import hmac
import json
import logging
import os
from decimal import Decimal

import mercadopago
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.db import transaction
from django.http import JsonResponse
from django.core import signing
from django.utils import timezone
from datetime import timedelta
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework import serializers
from rest_framework.decorators import api_view, permission_classes, throttle_classes
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle
from rest_framework_simplejwt.tokens import RefreshToken

from .emails import enviar_confirmacion_pedido, instrucciones_pago
from .models import Combo, ItemPedido, Pedido, Producto, SolicitudAtencion
from .shipping import (
    ErrorCotizacionEnvio,
    calcular_distancia_ruta_km,
    costo_envio_para_distancia,
    destino_formateado,
)

User = get_user_model()
logger = logging.getLogger(__name__)


class SolicitudAtencionThrottle(AnonRateThrottle):
    scope = "solicitud_atencion"

    def allow_request(self, request, view):
        if request.data.get("tipo") == "arrepentimiento":
            return True
        return super().allow_request(request, view)


def usuario_json(user):
    return {"id": user.id, "nombre_completo": user.first_name or user.get_username(), "email": user.email}


def auth_payload(user):
    return {"token": str(RefreshToken.for_user(user).access_token), "usuario": usuario_json(user)}


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    return Response({"status": "ok", "servicio": "Ragnar Suplementos API Django"})


@api_view(["POST"])
@permission_classes([AllowAny])
def registro(request):
    nombre = str(request.data.get("nombre_completo", "")).strip()
    email = str(request.data.get("email", "")).strip().lower()
    password = str(request.data.get("password", ""))
    if not nombre or not email or not password:
        return Response({"detail": "Completá nombre, email y contraseña."}, status=400)
    if len(password) < 8:
        return Response({"detail": "La contraseña debe tener al menos 8 caracteres."}, status=400)
    if User.objects.filter(email__iexact=email).exists():
        return Response({"detail": "Ya existe una cuenta con ese email."}, status=400)
    user = User.objects.create_user(username=email, email=email, first_name=nombre, password=password)
    return Response(auth_payload(user), status=201)


@api_view(["POST"])
@permission_classes([AllowAny])
def login(request):
    email = str(request.data.get("email", "")).strip().lower()
    password = str(request.data.get("password", ""))
    user = authenticate(request, username=email, password=password)
    if user is None:
        return Response({"detail": "Email o contraseña incorrectos."}, status=401)
    return Response(auth_payload(user))


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def perfil(request):
    return Response(usuario_json(request.user))


def producto_json(producto):
    return {
        "id": producto.id,
        "slug": producto.slug,
        "nombre": producto.nombre,
        "categoria": producto.categoria,
        "precio": float(producto.precio),
        "imagen": producto.imagen_archivo.url if producto.imagen_archivo else producto.imagen,
        "descripcion": producto.descripcion,
        "sabores": producto.sabores,
        "stock": producto.stock,
    }


def combo_json(combo):
    productos = list(combo.productos.filter(activo=True))
    return {
        "id": combo.id,
        "slug": combo.slug,
        "nombre": combo.nombre,
        "descripcion": combo.descripcion,
        "precio": float(combo.precio),
        "imagen": combo.imagen_archivo.url if combo.imagen_archivo else combo.imagen,
        "productosIds": [producto.id for producto in productos],
        "productos": [producto_json(producto) for producto in productos],
        "stock": min((producto.stock for producto in productos), default=0),
    }


@api_view(["GET"])
@permission_classes([AllowAny])
def productos(request):
    qs = Producto.objects.filter(activo=True).order_by("id")
    categoria = request.query_params.get("categoria")
    if categoria and categoria != "todos":
        qs = qs.filter(categoria=categoria)
    return Response([producto_json(p) for p in qs])


@api_view(["GET"])
@permission_classes([AllowAny])
def producto_detalle(request, slug):
    try:
        producto = Producto.objects.get(slug=slug, activo=True)
    except Producto.DoesNotExist:
        return Response({"detail": "Producto no encontrado."}, status=404)
    return Response(producto_json(producto))


@api_view(["GET"])
@permission_classes([AllowAny])
def combos(request):
    return Response([combo_json(c) for c in Combo.objects.filter(activo=True).order_by("id").prefetch_related("productos")])


@api_view(["GET"])
@permission_classes([AllowAny])
def combo_detalle(request, slug):
    try:
        combo = Combo.objects.prefetch_related("productos").get(slug=slug, activo=True)
    except Combo.DoesNotExist:
        return Response({"detail": "Combo no encontrado."}, status=404)
    return Response(combo_json(combo))


class ItemCompraSerializer(serializers.Serializer):
    tipo = serializers.ChoiceField(choices=("producto", "combo"))
    id = serializers.IntegerField(min_value=1)
    cantidad = serializers.IntegerField(min_value=1, max_value=20)
    sabor = serializers.CharField(required=False, allow_blank=True, max_length=100)


class CheckoutSerializer(serializers.Serializer):
    items = ItemCompraSerializer(many=True, allow_empty=False)
    nombre_comprador = serializers.CharField(max_length=150)
    telefono_comprador = serializers.CharField(max_length=30)
    email_comprador = serializers.EmailField()
    medio_pago = serializers.ChoiceField(choices=("mercado_pago", "transferencia", "local"))
    forma_entrega = serializers.ChoiceField(choices=("retiro", "envio"), default="retiro")
    direccion_entrega = serializers.CharField(required=False, allow_blank=True, max_length=300)
    cotizacion_envio = serializers.CharField(required=False, allow_blank=True)


class CotizarEnvioSerializer(serializers.Serializer):
    direccion = serializers.CharField(max_length=200)


class SolicitudAtencionSerializer(serializers.Serializer):
    tipo = serializers.ChoiceField(choices=("arrepentimiento", "reclamo", "consulta"))
    nombre = serializers.CharField(max_length=150)
    email = serializers.EmailField()
    telefono = serializers.CharField(required=False, allow_blank=True, max_length=30)
    numero_pedido = serializers.CharField(required=False, allow_blank=True, max_length=30)
    mensaje = serializers.CharField(required=False, allow_blank=True, max_length=3000)

    def validate(self, attrs):
        if attrs["tipo"] == "arrepentimiento" and not attrs.get("numero_pedido", "").strip():
            raise serializers.ValidationError({"numero_pedido": "Indicá el número de pedido para ubicar la compra."})
        if attrs["tipo"] != "arrepentimiento" and not attrs.get("mensaje", "").strip():
            raise serializers.ValidationError({"mensaje": "Escribí el motivo de tu consulta."})
        return attrs


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([SolicitudAtencionThrottle])
def crear_solicitud_atencion(request):
    serializer = SolicitudAtencionSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    solicitud = SolicitudAtencion.objects.create(**serializer.validated_data)
    return Response({"id": solicitud.pk, "detail": "Recibimos tu solicitud."}, status=201)


@api_view(["GET"])
@permission_classes([AllowAny])
def metodos_pago(request):
    metodos = []
    token = os.getenv("MP_ACCESS_TOKEN", "")
    mp_habilitado = os.getenv("MP_ENABLED", "false").lower() == "true" and bool(token) and not token.startswith("TU_")
    if mp_habilitado:
        metodos.append({"id": "mercado_pago", "nombre": "Tarjeta u otros medios con Mercado Pago", "disponible": True})

    alias = os.getenv("PAGO_ALIAS", "")
    cvu = os.getenv("PAGO_CVU", "")
    titular = os.getenv("PAGO_TITULAR", "")
    metodos.append({
        "id": "transferencia",
        "nombre": "Transferencia a Personal Pay",
        "disponible": bool(alias or cvu),
        "alias": alias,
        "cvu": cvu,
        "titular": titular,
        "detalle": "La transferencia se confirma manualmente al recibir el comprobante.",
    })
    metodos.append({
        "id": "local",
        "nombre": "Pagar en el local al retirar",
        "disponible": True,
        "detalle": "Pago en efectivo al retirar o al recibir el envío.",
    })
    return Response(metodos)


@api_view(["POST"])
@permission_classes([AllowAny])
def cotizar_envio(request):
    serializer = CotizarEnvioSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    destino = destino_formateado(serializer.validated_data["direccion"])
    try:
        distancia = calcular_distancia_ruta_km(destino)
        costo = costo_envio_para_distancia(distancia)
    except ErrorCotizacionEnvio as exc:
        return Response({"detail": str(exc)}, status=exc.status_code)

    if costo is None:
        return Response({"detail": "La dirección supera nuestra distancia de entrega automática. Consultanos por WhatsApp."}, status=400)

    cotizacion = signing.dumps(
        {
            "destino": destino.casefold(),
            "distancia_km": str(distancia),
            "costo_envio": str(costo),
            "origen": os.getenv("ENVIO_ORIGEN", "Azcuénaga 991, Formosa, Formosa, Argentina"),
        },
        salt="ragnar-cotizacion-envio",
    )
    return Response({
        "direccion": destino,
        "distancia_km": float(distancia),
        "costo_envio": float(costo),
        "cotizacion_envio": cotizacion,
        "vigencia_minutos": 15,
    })


@api_view(["POST"])
@permission_classes([AllowAny])
def crear_preferencia(request):
    serializer = CheckoutSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    medio_pago = serializer.validated_data["medio_pago"]
    forma_entrega = serializer.validated_data["forma_entrega"]
    direccion_entrega = ""
    distancia_envio = None
    costo_envio = 0
    if forma_entrega == "envio":
        direccion_entrega = serializer.validated_data.get("direccion_entrega", "").strip()
        cotizacion_token = serializer.validated_data.get("cotizacion_envio", "")
        if not direccion_entrega or not cotizacion_token:
            return Response({"detail": "Ingresá la dirección y calculá el costo del envío antes de confirmar."}, status=400)
        destino = destino_formateado(direccion_entrega)
        try:
            datos_cotizacion = signing.loads(cotizacion_token, salt="ragnar-cotizacion-envio", max_age=900)
        except signing.BadSignature:
            return Response({"detail": "La cotización venció o cambió. Calculá nuevamente el envío."}, status=400)
        origen_actual = os.getenv("ENVIO_ORIGEN", "Azcuénaga 991, Formosa, Formosa, Argentina")
        if datos_cotizacion.get("destino") != destino.casefold() or datos_cotizacion.get("origen") != origen_actual:
            return Response({"detail": "La cotización no coincide con la dirección. Calculá nuevamente el envío."}, status=400)
        distancia_envio = Decimal(datos_cotizacion["distancia_km"])
        costo_envio = Decimal(datos_cotizacion["costo_envio"])
    token = os.getenv("MP_ACCESS_TOKEN", "")
    mp_habilitado = os.getenv("MP_ENABLED", "false").lower() == "true" and bool(token) and not token.startswith("TU_")
    if medio_pago == "mercado_pago" and not mp_habilitado:
        return Response({"detail": "Mercado Pago no está habilitado en este momento. Elegí transferencia o pago en el local."}, status=503)
    if medio_pago == "transferencia" and not (os.getenv("PAGO_ALIAS") or os.getenv("PAGO_CVU")):
        return Response({"detail": "La transferencia a Personal Pay todavía no está configurada."}, status=503)

    items_solicitados = serializer.validated_data["items"]
    mp_items = []
    cantidades_stock = {}
    total = 0
    pedido = None

    try:
        with transaction.atomic():
            pedido = Pedido.objects.create(
                usuario=request.user if request.user.is_authenticated else None,
                nombre_comprador=serializer.validated_data["nombre_comprador"].strip(),
                telefono_comprador=serializer.validated_data["telefono_comprador"].strip(),
                email_comprador=serializer.validated_data["email_comprador"],
                total=0,
                proveedor_pago=medio_pago,
                forma_entrega=forma_entrega,
                direccion_entrega=direccion_entrega,
                distancia_envio_km=distancia_envio,
                costo_envio=costo_envio,
            )
            for linea in items_solicitados:
                componentes_combo = []
                if linea["tipo"] == "producto":
                    obj = Producto.objects.get(pk=linea["id"], activo=True)
                    nombre, precio = obj.nombre, obj.precio
                    producto, combo = obj, None
                    cantidades_stock[obj.id] = cantidades_stock.get(obj.id, 0) + linea["cantidad"]
                else:
                    obj = Combo.objects.prefetch_related("productos").get(pk=linea["id"], activo=True)
                    nombre, precio = obj.nombre, obj.precio
                    producto, combo = None, obj
                    componentes_ids = list(obj.productos.filter(activo=True).values_list("id", flat=True))
                    componentes_combo = componentes_ids
                    for producto_id in componentes_ids:
                        cantidades_stock[producto_id] = cantidades_stock.get(producto_id, 0) + linea["cantidad"]
                    if not componentes_ids:
                        raise serializers.ValidationError({"detail": f"El combo {nombre} no tiene productos disponibles."})
                sabor = linea.get("sabor", "")
                ItemPedido.objects.create(
                    pedido=pedido,
                    producto=producto,
                    combo=combo,
                    nombre=nombre,
                    sabor=sabor,
                    cantidad=linea["cantidad"],
                    precio_unitario=precio,
                    componentes_combo=componentes_combo,
                )
                mp_items.append({
                    "title": nombre + (f" ({sabor})" if sabor else ""),
                    "quantity": linea["cantidad"],
                    "unit_price": float(precio),
                    "currency_id": "ARS",
                })
                total += precio * linea["cantidad"]
            productos_bloqueados = list(
                Producto.objects.select_for_update().filter(id__in=cantidades_stock).order_by("id")
            )
            if len(productos_bloqueados) != len(cantidades_stock):
                raise serializers.ValidationError({"detail": "Uno de los productos dejó de estar disponible."})
            for producto_stock in productos_bloqueados:
                if producto_stock.stock < cantidades_stock[producto_stock.id]:
                    raise serializers.ValidationError({"detail": f"Stock insuficiente para {producto_stock.nombre}."})
            reservar_stock = medio_pago in ("transferencia", "local")
            if reservar_stock:
                for producto_stock in productos_bloqueados:
                    producto_stock.stock -= cantidades_stock[producto_stock.id]
                    producto_stock.save(update_fields=["stock", "actualizado"])
            if costo_envio:
                mp_items.append({
                    "title": f"Envío a domicilio ({distancia_envio} km)",
                    "quantity": 1,
                    "unit_price": float(costo_envio),
                    "currency_id": "ARS",
                })
            pedido.total = total + costo_envio
            pedido.stock_reservado = reservar_stock
            if reservar_stock:
                pedido.stock_reservado_hasta = timezone.now() + timedelta(
                    minutes=settings.PEDIDO_RESERVA_MINUTOS
                )
            pedido.save(update_fields=["total", "stock_reservado", "stock_reservado_hasta"])
    except (Producto.DoesNotExist, Combo.DoesNotExist):
        return Response({"detail": "Uno de los productos o combos ya no está disponible."}, status=400)
    except serializers.ValidationError as exc:
        return Response(exc.detail, status=400)

    if medio_pago in ("transferencia", "local"):
        try:
            email_enviado = enviar_confirmacion_pedido(pedido, medio_pago)
        except Exception:
            logger.exception("No se pudo enviar el correo del pedido %s", pedido.id)
            email_enviado = False
        datos_pago = instrucciones_pago(medio_pago, forma_entrega=forma_entrega)
        return Response({
            "tipo": "manual",
            "pedido_id": pedido.id,
            "stock_reservado_hasta": pedido.stock_reservado_hasta.isoformat() if pedido.stock_reservado_hasta else None,
            "medio_pago": medio_pago,
            "total": float(pedido.total),
            "costo_envio": float(pedido.costo_envio),
            "distancia_envio_km": float(pedido.distancia_envio_km) if pedido.distancia_envio_km is not None else None,
            "forma_entrega": pedido.forma_entrega,
            "direccion_entrega": pedido.direccion_entrega,
            "datos_pago": datos_pago,
            "email_enviado": email_enviado,
        }, status=201)

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000").split(",")[0].rstrip("/")
    sdk = mercadopago.SDK(token)
    preference_data = {
        "items": mp_items,
        "payer": {"email": pedido.email_comprador},
        "external_reference": str(pedido.id),
        "back_urls": {
            "success": f"{frontend_url}/?pago=exitoso",
            "failure": f"{frontend_url}/?pago=fallido",
            "pending": f"{frontend_url}/?pago=pendiente",
        },
        "auto_return": "approved",
        "metadata": {"pedido_id": pedido.id},
    }
    webhook_url = os.getenv("MP_WEBHOOK_URL", "")
    if webhook_url:
        preference_data["notification_url"] = webhook_url
    try:
        resultado = sdk.preference().create(preference_data)
    except Exception:
        pedido.delete()
        logger.exception("No se pudo crear la preferencia de Mercado Pago para el pedido %s", pedido.id)
        return Response({"detail": "No pudimos conectar con Mercado Pago. Intentá nuevamente."}, status=502)
    if resultado.get("status") not in (200, 201):
        pedido.delete()
        return Response({"detail": "Mercado Pago no pudo crear el checkout."}, status=502)

    respuesta = resultado.get("response", {})
    if not respuesta.get("id") or not respuesta.get("init_point"):
        pedido.delete()
        logger.error("Mercado Pago devolvió una preferencia incompleta para el pedido %s", pedido.id)
        return Response({"detail": "Mercado Pago devolvió una respuesta incompleta."}, status=502)
    pedido.preferencia_id = str(respuesta.get("id", ""))
    pedido.save(update_fields=["preferencia_id"])
    return Response({
        "tipo": "mercado_pago",
        "id": respuesta.get("id"),
        "init_point": respuesta.get("init_point"),
        "pedido_id": pedido.id,
    }, status=201)


def firma_webhook_valida(request):
    secret = os.getenv("MP_WEBHOOK_SECRET", "")
    if not secret:
        return False
    signature = request.headers.get("x-signature", "")
    request_id = request.headers.get("x-request-id", "")
    data_id = request.GET.get("data.id", "").lower()
    parts = dict(part.split("=", 1) for part in signature.split(",") if "=" in part)
    timestamp, received = parts.get("ts"), parts.get("v1")
    if not timestamp or not received:
        return False
    manifest = f"id:{data_id};request-id:{request_id};ts:{timestamp};"
    expected = hmac.new(secret.encode(), manifest.encode(), hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, received)


@csrf_exempt
@require_POST
def webhook_mercado_pago(request):
    if not firma_webhook_valida(request):
        return JsonResponse({"detail": "Firma inválida."}, status=401)
    try:
        body = json.loads(request.body or b"{}")
    except json.JSONDecodeError:
        return JsonResponse({"detail": "JSON inválido."}, status=400)
    pago_id = request.GET.get("data.id") or body.get("data", {}).get("id")
    if not pago_id:
        return JsonResponse({"received": True})
    token = os.getenv("MP_ACCESS_TOKEN", "")
    if not token:
        return JsonResponse({"detail": "Mercado Pago no configurado."}, status=503)
    resultado = mercadopago.SDK(token).payment().get(pago_id)
    if resultado.get("status") != 200:
        return JsonResponse({"detail": "No se pudo consultar el pago."}, status=502)
    pago = resultado.get("response", {})
    pedido_id = pago.get("external_reference")
    if pedido_id:
        estados = {"approved": "aprobado", "rejected": "rechazado", "cancelled": "cancelado"}
        correo_confirmacion = None
        with transaction.atomic():
            pedido = Pedido.objects.select_for_update().filter(pk=pedido_id).first()
            if pedido and pedido.estado == "pendiente":
                nuevo_estado = estados.get(pago.get("status"), "pendiente")
                if nuevo_estado == "aprobado":
                    cantidades = {}
                    for item in pedido.items.select_related("producto", "combo").all():
                        if item.producto_id:
                            cantidades[item.producto_id] = cantidades.get(item.producto_id, 0) + item.cantidad
                        elif item.combo_id:
                            for producto_id in item.combo.productos.values_list("id", flat=True):
                                cantidades[producto_id] = cantidades.get(producto_id, 0) + item.cantidad
                    productos_bloqueados = list(
                        Producto.objects.select_for_update().filter(id__in=cantidades).order_by("id")
                    )
                    if any(p.stock < cantidades[p.id] for p in productos_bloqueados):
                        nuevo_estado = "revisar_stock"
                    else:
                        for producto in productos_bloqueados:
                            producto.stock -= cantidades[producto.id]
                            producto.save(update_fields=["stock", "actualizado"])
                pedido.estado = nuevo_estado
                pedido.pago_id = str(pago_id)
                pedido.save(update_fields=["estado", "pago_id", "actualizado"])
                if nuevo_estado == "aprobado":
                    correo_confirmacion = pedido
        if correo_confirmacion:
            try:
                enviar_confirmacion_pedido(correo_confirmacion, "mercado_pago", pago_confirmado=True)
            except Exception:
                logger.exception("No se pudo enviar el correo de pago confirmado del pedido %s", pedido_id)
    return JsonResponse({"received": True})
