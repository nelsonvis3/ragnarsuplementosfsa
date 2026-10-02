import hashlib
import hmac
import json
import logging
import os
import hashlib
from decimal import Decimal, InvalidOperation
from urllib.parse import urlencode

import mercadopago
from django.conf import settings
from django.contrib.auth import authenticate, get_user_model
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.core.validators import validate_email
from django.db import IntegrityError, transaction
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
from .orders import _cantidades_del_pedido, resolver_revision_pago
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


class RegistroThrottle(AnonRateThrottle):
    scope = "registro"


class LoginThrottle(AnonRateThrottle):
    scope = "login"


class PagoRetornoThrottle(AnonRateThrottle):
    scope = "pago_retorno"


def usuario_json(user):
    return {"id": user.id, "nombre_completo": user.first_name or user.get_username(), "email": user.email}


def auth_payload(user):
    return {"token": str(RefreshToken.for_user(user).access_token), "usuario": usuario_json(user)}


@api_view(["GET"])
@permission_classes([AllowAny])
def health(request):
    from django.db import DatabaseError, connection

    try:
        connection.ensure_connection()
    except DatabaseError:
        logger.exception("Health check: no se pudo conectar a la base de datos.")
        return Response({"status": "unavailable", "database": "unavailable"}, status=503)
    return Response({"status": "ok", "database": "ok", "servicio": "Ragnar Suplementos API Django"})


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([RegistroThrottle])
def registro(request):
    nombre = str(request.data.get("nombre_completo", "")).strip()
    email = str(request.data.get("email", "")).strip().lower()
    password = str(request.data.get("password", ""))
    if not nombre or not email or not password:
        return Response({"detail": "Completá nombre, email y contraseña."}, status=400)
    try:
        validate_email(email)
    except DjangoValidationError:
        return Response({"email": "Ingresá un email válido."}, status=400)
    if len(email) > 254:
        return Response({"email": "El email no puede superar los 254 caracteres."}, status=400)
    max_largo_usuario = User._meta.get_field(User.USERNAME_FIELD).max_length
    if max_largo_usuario and len(email) > max_largo_usuario:
        return Response({"email": f"El email no puede superar los {max_largo_usuario} caracteres para esta cuenta."}, status=400)
    if User.objects.filter(email__iexact=email).exists():
        return Response({"detail": "Ya existe una cuenta con ese email."}, status=400)
    candidato = User(username=email, email=email, first_name=nombre)
    try:
        validate_password(password, user=candidato)
    except DjangoValidationError as exc:
        return Response({"password": list(exc.messages)}, status=400)
    try:
        with transaction.atomic():
            user = User.objects.create_user(username=email, email=email, first_name=nombre, password=password)
    except IntegrityError:
        return Response({"detail": "Ya existe una cuenta con ese email."}, status=400)
    return Response(auth_payload(user), status=201)


@api_view(["POST"])
@permission_classes([AllowAny])
@throttle_classes([LoginThrottle])
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
    checkout_key = serializers.UUIDField()
    items = ItemCompraSerializer(many=True, allow_empty=False)
    nombre_comprador = serializers.CharField(max_length=150)
    telefono_comprador = serializers.CharField(max_length=30)
    email_comprador = serializers.EmailField()
    medio_pago = serializers.ChoiceField(choices=("mercado_pago", "transferencia", "local"))
    forma_entrega = serializers.ChoiceField(choices=("retiro", "envio"), default="retiro")
    direccion_entrega = serializers.CharField(required=False, allow_blank=True, max_length=300)
    cotizacion_envio = serializers.CharField(required=False, allow_blank=True)

    def validate_items(self, items):
        if len(items) > 50:
            raise serializers.ValidationError("El pedido no puede tener más de 50 líneas.")
        return items


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
        if not attrs.get("mensaje", "").strip():
            texto = "Contanos brevemente el motivo de tu arrepentimiento." if attrs["tipo"] == "arrepentimiento" else "Escribí el motivo de tu consulta."
            raise serializers.ValidationError({"mensaje": texto})
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
    token = os.getenv("MP_ACCESS_TOKEN", "").strip()
    mp_habilitado = os.getenv("MP_ENABLED", "false").strip().lower() == "true" and bool(token) and not token.startswith("TU_")
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


def respuesta_checkout_existente(pedido, hash_payload):
    if pedido.checkout_payload_hash != hash_payload:
        return Response({"detail": "La clave de checkout ya se usó con otros datos. Recargá el carrito e intentá nuevamente."}, status=409)
    if pedido.estado == "cancelado":
        return Response({"detail": "La reserva del pedido anterior venció o fue cancelada. Volvé a confirmar para crear un pedido nuevo."}, status=409)
    if pedido.proveedor_pago == "mercado_pago":
        if pedido.preferencia_url and pedido.estado == "pendiente":
            return Response({
                "tipo": "mercado_pago",
                "id": pedido.preferencia_id,
                "init_point": pedido.preferencia_url,
                "pedido_id": pedido.pk,
            })
        return Response({"detail": f"El pedido #{pedido.pk} ya está registrado. Consultanos antes de volver a pagar."}, status=409)
    if pedido.estado != "pendiente":
        return Response({"detail": f"El pedido #{pedido.pk} ya fue procesado y está {pedido.get_estado_display().lower()}."}, status=409)
    return Response({
        "tipo": "manual",
        "pedido_id": pedido.pk,
        "stock_reservado_hasta": pedido.stock_reservado_hasta.isoformat() if pedido.stock_reservado_hasta else None,
        "medio_pago": pedido.proveedor_pago,
        "total": float(pedido.total),
        "costo_envio": float(pedido.costo_envio),
        "distancia_envio_km": float(pedido.distancia_envio_km) if pedido.distancia_envio_km is not None else None,
        "forma_entrega": pedido.forma_entrega,
        "direccion_entrega": pedido.direccion_entrega,
        "datos_pago": instrucciones_pago(pedido.proveedor_pago, forma_entrega=pedido.forma_entrega),
        "email_enviado": False,
    })


@api_view(["POST"])
@permission_classes([AllowAny])
def crear_preferencia(request):
    serializer = CheckoutSerializer(data=request.data)
    serializer.is_valid(raise_exception=True)
    medio_pago = serializer.validated_data["medio_pago"]
    checkout_key = serializer.validated_data["checkout_key"]
    datos_payload = dict(serializer.validated_data)
    datos_payload.pop("checkout_key", None)
    datos_payload["usuario_id"] = request.user.pk if request.user.is_authenticated else None
    hash_payload = hashlib.sha256(
        json.dumps(datos_payload, sort_keys=True, default=str, ensure_ascii=False).encode("utf-8")
    ).hexdigest()
    pedido_existente = Pedido.objects.filter(checkout_key=checkout_key).first()
    if pedido_existente:
        return respuesta_checkout_existente(pedido_existente, hash_payload)
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
    token = os.getenv("MP_ACCESS_TOKEN", "").strip()
    mp_habilitado = os.getenv("MP_ENABLED", "false").strip().lower() == "true" and bool(token) and not token.startswith("TU_")
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
                checkout_key=checkout_key,
                checkout_payload_hash=hash_payload,
            )
            for linea in items_solicitados:
                componentes_combo = []
                if linea["tipo"] == "producto":
                    obj = Producto.objects.get(pk=linea["id"], activo=True)
                    nombre, precio = obj.nombre, obj.precio
                    producto, combo = obj, None
                    sabor = linea.get("sabor", "").strip()
                    sabores_disponibles = {
                        opcion.get("nombre", "") if isinstance(opcion, dict) else str(opcion)
                        for opcion in obj.sabores
                    }
                    if (sabores_disponibles and sabor not in sabores_disponibles) or (
                        sabor and sabor not in sabores_disponibles
                    ):
                        raise serializers.ValidationError({"detail": f"El sabor elegido para {nombre} ya no está disponible."})
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
                    sabor = ""
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
            reservar_stock = True
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
    except IntegrityError:
        pedido_existente = Pedido.objects.filter(checkout_key=checkout_key).first()
        if pedido_existente:
            return respuesta_checkout_existente(pedido_existente, hash_payload)
        raise

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
    return_token = signing.dumps({"pedido_id": pedido.id}, salt="ragnar-pago-return")

    def url_retorno(estado):
        query = urlencode({"pago": estado, "pedido_id": pedido.id, "token": return_token})
        return f"{frontend_url}/?{query}"

    preference_data = {
        "items": mp_items,
        "payer": {"email": pedido.email_comprador},
        "external_reference": str(pedido.id),
        "back_urls": {
            "success": url_retorno("exitoso"),
            "failure": url_retorno("fallido"),
            "pending": url_retorno("pendiente"),
        },
        "auto_return": "approved",
        "metadata": {"pedido_id": pedido.id},
    }
    webhook_url = os.getenv("MP_WEBHOOK_URL", "").strip()
    if webhook_url:
        preference_data["notification_url"] = webhook_url
    try:
        resultado = sdk.preference().create(preference_data)
    except Exception:
        pedido.estado = "revision_pago"
        pedido.save(update_fields=["estado", "actualizado"])
        logger.exception("No se pudo crear la preferencia de Mercado Pago para el pedido %s", pedido.id)
        return Response({"detail": f"No pudimos confirmar el resultado al crear el pago del pedido #{pedido.id}. Contactanos antes de volver a intentarlo."}, status=502)
    if resultado.get("status") not in (200, 201):
        pedido.estado = "revision_pago"
        pedido.save(update_fields=["estado", "actualizado"])
        logger.error("Mercado Pago respondió %s al crear preferencia para pedido %s", resultado.get("status"), pedido.id)
        return Response({"detail": "Mercado Pago no pudo crear el checkout."}, status=502)

    respuesta = resultado.get("response", {})
    if not respuesta.get("id") or not respuesta.get("init_point"):
        pedido.estado = "revision_pago"
        pedido.save(update_fields=["estado", "actualizado"])
        logger.error("Mercado Pago devolvió una preferencia incompleta para el pedido %s", pedido.id)
        return Response({"detail": "Mercado Pago devolvió una respuesta incompleta."}, status=502)
    pedido.preferencia_id = str(respuesta.get("id", ""))
    pedido.preferencia_url = respuesta["init_point"]
    pedido.save(update_fields=["preferencia_id", "preferencia_url"])
    return Response({
        "tipo": "mercado_pago",
        "id": respuesta.get("id"),
        "init_point": respuesta.get("init_point"),
        "pedido_id": pedido.id,
        "stock_reservado_hasta": pedido.stock_reservado_hasta.isoformat() if pedido.stock_reservado_hasta else None,
    }, status=201)


def firma_webhook_valida(request):
    secret = os.getenv("MP_WEBHOOK_SECRET", "").strip()
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


def registrar_pago_adicional(pedido, pago_id, estado):
    pagos = list(pedido.pagos_adicionales or [])
    pago_id = str(pago_id)
    adicional = next((pago for pago in pagos if pago.get("id") == pago_id), None)
    if adicional:
        adicional["estado"] = estado
    else:
        pagos.append({"id": pago_id, "estado": estado})
    pedido.pagos_adicionales = pagos
    pedido.save(update_fields=["pagos_adicionales", "actualizado"])


def procesar_notificacion_pago(pago_id, pedido_esperado=None):
    """Consulta un pago en Mercado Pago y actualiza pedido e inventario una sola vez."""
    pago_id = str(pago_id)
    if not pago_id.isdigit() or len(pago_id) > 40:
        return None, "pago_invalido"
    token = os.getenv("MP_ACCESS_TOKEN", "").strip()
    if not token:
        return None, "configuracion"
    try:
        resultado = mercadopago.SDK(token).payment().get(pago_id)
    except Exception:
        logger.exception("No se pudo consultar el pago %s en Mercado Pago.", pago_id)
        return None, "error_mp"
    if resultado.get("status") != 200:
        logger.error("Mercado Pago respondió %s al consultar el pago %s.", resultado.get("status"), pago_id)
        return None, "error_mp"

    pago = resultado.get("response", {})
    try:
        pedido_id = int(pago.get("external_reference"))
    except (TypeError, ValueError):
        return None, "pedido_invalido"
    if pedido_esperado is not None and pedido_id != pedido_esperado:
        return None, "pedido_mismatch"

    correo_confirmacion = None
    with transaction.atomic():
        pedido = Pedido.objects.select_for_update().filter(pk=pedido_id, proveedor_pago="mercado_pago").first()
        if not pedido:
            return None, "pedido_inexistente"
        if pedido.estado == "aprobado":
            if pago.get("status") in ("refunded", "charged_back") and pedido.pago_id == str(pago_id):
                pedido.estado = "reembolsado" if pago.get("status") == "refunded" else "contracargo"
                pedido.save(update_fields=["estado", "actualizado"])
                return pedido, pedido.estado
            if pedido.pago_id != str(pago_id) and pago.get("status") in ("approved", "refunded", "charged_back"):
                estado_adicional = {
                    "approved": "aprobado",
                    "refunded": "reembolsado",
                    "charged_back": "contracargo",
                }[pago["status"]]
                registrar_pago_adicional(pedido, pago_id, estado_adicional)
            if pago.get("status") == "approved" and pedido.pago_id != str(pago_id):
                logger.critical(
                    "Se detectó un segundo pago %s para el pedido ya aprobado %s (pago registrado: %s). Revisar/reembolsar en Mercado Pago.",
                    pago_id,
                    pedido_id,
                    pedido.pago_id,
                )
            return pedido, pedido.estado
        if pedido.estado == "revisar_stock":
            if pago.get("status") in ("refunded", "charged_back") and pedido.pago_id == str(pago_id):
                pedido.estado = "reembolsado" if pago.get("status") == "refunded" else "contracargo"
                pedido.save(update_fields=["estado", "actualizado"])
                return pedido, pedido.estado
            if pedido.pago_id != str(pago_id) and pago.get("status") in ("approved", "refunded", "charged_back"):
                estado_adicional = {
                    "approved": "aprobado",
                    "refunded": "reembolsado",
                    "charged_back": "contracargo",
                }[pago["status"]]
                registrar_pago_adicional(pedido, pago_id, estado_adicional)
                if estado_adicional == "aprobado":
                    logger.critical("Se detectó un pago adicional %s para el pedido %s en revisión de stock.", pago_id, pedido_id)
            return pedido, pedido.estado
        if pedido.estado == "reembolsado":
            return pedido, pedido.estado
        if pedido.estado == "contracargo":
            return pedido, pedido.estado
        if (
            pedido.estado == "revision_pago"
            and pedido.pago_id
            and pedido.pago_id != str(pago_id)
            and pago.get("status") in ("approved", "refunded", "charged_back")
        ):
            estado_adicional = {
                "approved": "aprobado",
                "refunded": "reembolsado",
                "charged_back": "contracargo",
            }[pago["status"]]
            registrar_pago_adicional(pedido, pago_id, estado_adicional)
            logger.critical(
                "Pago adicional %s recibido para pedido %s que ya tiene un pago en revisión (%s).",
                pago_id,
                pedido_id,
                pedido.pago_id,
            )
            return pedido, pedido.estado
        if pedido.estado == "cancelado" and pago.get("status") not in ("approved", "refunded", "charged_back"):
            return pedido, pedido.estado
        if pedido.estado not in ("pendiente", "revision_pago", "cancelado"):
            return pedido, pedido.estado

        estado_mp = pago.get("status")
        nuevo_estado = "pendiente"  # Rechazos/cancelaciones son intentos, no el estado final del pedido.
        if estado_mp in ("refunded", "charged_back"):
            if pedido.stock_reservado:
                cantidades = _cantidades_del_pedido(pedido)
                productos = list(Producto.objects.select_for_update().filter(pk__in=cantidades).order_by("id"))
                if len(productos) != len(cantidades):
                    logger.error("No se pudo liberar la reserva del pedido reembolsado %s: falta un producto.", pedido_id)
                    pedido.estado = "revision_pago"
                    pedido.pago_id = str(pago_id)
                    pedido.save(update_fields=["estado", "pago_id", "actualizado"])
                    return pedido, pedido.estado
                for producto in productos:
                    producto.stock += cantidades[producto.id]
                    producto.save(update_fields=["stock", "actualizado"])
            nuevo_estado = "reembolsado" if estado_mp == "refunded" else "contracargo"
        elif estado_mp == "approved":
            try:
                importe_pagado = Decimal(str(pago.get("transaction_amount")))
            except (InvalidOperation, TypeError, ValueError):
                importe_pagado = None
            if pago.get("currency_id") != "ARS" or importe_pagado != pedido.total:
                logger.error(
                    "El pago %s no coincide con el pedido %s: importe %s %s; esperado %s ARS",
                    pago_id,
                    pedido_id,
                    importe_pagado,
                    pago.get("currency_id"),
                    pedido.total,
                )
                pedido.estado = "revision_pago"
                pedido.pago_id = str(pago_id)
                pedido.save(update_fields=["estado", "pago_id", "actualizado"])
                return pedido, pedido.estado

            if pedido.stock_reservado:
                nuevo_estado = "aprobado"
            else:
                cantidades = _cantidades_del_pedido(pedido)
                productos = list(Producto.objects.select_for_update().filter(pk__in=cantidades).order_by("id"))
                if len(productos) != len(cantidades) or any(p.stock < cantidades[p.id] for p in productos):
                    nuevo_estado = "revisar_stock"
                else:
                    for producto in productos:
                        producto.stock -= cantidades[producto.id]
                        producto.save(update_fields=["stock", "actualizado"])
                    nuevo_estado = "aprobado"
        pedido.estado = nuevo_estado
        pedido.pago_id = str(pago_id)
        if nuevo_estado in ("aprobado", "revisar_stock", "reembolsado", "contracargo"):
            pedido.stock_reservado = False
            pedido.stock_reservado_hasta = None
        pedido.save(update_fields=["estado", "pago_id", "stock_reservado", "stock_reservado_hasta", "actualizado"])
        if nuevo_estado == "aprobado":
            correo_confirmacion = pedido

    if correo_confirmacion:
        try:
            enviar_confirmacion_pedido(correo_confirmacion, "mercado_pago", pago_confirmado=True)
        except Exception:
            logger.exception("No se pudo enviar el correo de pago confirmado del pedido %s", pedido_id)
    return pedido, pedido.estado


@api_view(["GET"])
@permission_classes([AllowAny])
@throttle_classes([PagoRetornoThrottle])
def verificar_pago_retorno(request):
    pedido_id = request.query_params.get("pedido_id", "")
    return_token = request.query_params.get("token", "")
    pago_id = request.query_params.get("payment_id") or request.query_params.get("collection_id")
    try:
        datos = signing.loads(return_token, salt="ragnar-pago-return", max_age=7 * 24 * 60 * 60)
    except signing.BadSignature:
        return Response({"detail": "El enlace de confirmación no es válido o venció."}, status=400)
    if str(datos.get("pedido_id")) != pedido_id or not pago_id or not pago_id.isdigit() or len(pago_id) > 40:
        return Response({"detail": "Faltan datos para verificar el pago."}, status=400)

    try:
        pedido_id_validado = int(pedido_id)
    except ValueError:
        return Response({"detail": "El pedido no es válido."}, status=400)
    pedido, resultado = procesar_notificacion_pago(pago_id, pedido_id_validado)
    if resultado == "error_mp":
        return Response({"detail": "No pudimos consultar el pago todavía."}, status=502)
    if not pedido:
        if resultado == "pedido_mismatch":
            return Response({"detail": "El pago no corresponde a este pedido."}, status=400)
        return Response({"detail": "No encontramos el pedido para verificar el pago."}, status=404)
    return Response({
        "pedido_id": pedido.pk,
        "estado": pedido.estado,
        "init_point": pedido.preferencia_url if pedido.estado == "pendiente" else "",
    })


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
    pedido, resultado = procesar_notificacion_pago(pago_id)
    if resultado == "configuracion":
        return JsonResponse({"detail": "Mercado Pago no configurado."}, status=503)
    if resultado == "error_mp":
        return JsonResponse({"detail": "No se pudo consultar el pago."}, status=502)
    return JsonResponse({"received": True})
