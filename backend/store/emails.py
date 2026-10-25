from email.message import MIMEPart

from django.conf import settings
from django.core.mail import EmailMultiAlternatives
from django.template.loader import render_to_string
from .models import ConfiguracionTienda
from .order_summary import nombre_pedido


def enviar_consulta_asesoramiento(solicitud):
    if not settings.ATENCION_EMAIL:
        raise RuntimeError("Configurá ATENCION_EMAIL para recibir consultas.")
    mensaje = EmailMultiAlternatives(
        subject=f"Nueva consulta #{solicitud.pk} — Ragnar Suplementos",
        body=(f"Nueva consulta de asesoramiento #{solicitud.pk}\n\n"
              f"Nombre: {solicitud.nombre}\nEmail: {solicitud.email}\n"
              f"Teléfono: {solicitud.telefono or 'No indicado'}\n"
              f"Pedido: {solicitud.numero_pedido or 'No indicado'}\n\n"
              f"{solicitud.mensaje}\n\nRespondé este correo para contactar al cliente.\n"
              "La consulta también está guardada en Solicitudes de atención de Django Admin."),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[settings.ATENCION_EMAIL],
        reply_to=[solicitud.email],
    )
    if mensaje.send(fail_silently=False) != 1:
        raise RuntimeError("El proveedor no aceptó la notificación de la consulta.")


def _pesos(valor):
    return f"${valor:,.0f}".replace(",", ".")


def _con_html(mensaje, plantilla, contexto):
    """Agrega la versión HTML y el logo que la plantilla base referencia como cid:ragnar-logo."""
    mensaje.attach_alternative(render_to_string(plantilla, contexto), "text/html")
    logo = MIMEPart()
    logo.set_content(
        (settings.ROOT_DIR / "public" / "logo.png").read_bytes(),
        maintype="image", subtype="png", disposition="inline", cid="<ragnar-logo>", filename="ragnar-logo.png",
    )
    mensaje.attach(logo)
    return mensaje


def enviar_bienvenida_registro(user, enlace):
    contexto = {"nombre": user.first_name, "enlace": enlace}
    mensaje = EmailMultiAlternatives(
        subject="Ragnar Suplementos — Desbloqueá tu potencial",
        body=render_to_string("store/emails/bienvenida.txt", contexto),
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
    )
    _con_html(mensaje, "store/emails/bienvenida.html", contexto)
    if mensaje.send(fail_silently=False) != 1:
        raise RuntimeError("El proveedor no aceptó el correo de confirmación.")


def enviar_recuperacion_contrasena(user, enlace):
    nombre = user.first_name or ""
    saludo = f"Hola, {nombre}." if nombre else "Hola."
    texto = (
        f"{saludo}\n\nRecibimos una solicitud para cambiar tu contraseña de Ragnar Suplementos.\n"
        f"Abrí este enlace para elegir una nueva:\n\n{enlace}\n\n"
        "El enlace vence en una hora y se puede usar una sola vez.\n"
        "Si no pediste este cambio, ignorá el correo: tu contraseña sigue siendo la misma."
    )
    mensaje = EmailMultiAlternatives(
        subject="Recuperá tu contraseña — Ragnar Suplementos",
        body=texto,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[user.email],
    )
    _con_html(mensaje, "store/emails/recuperacion.html", {"saludo": saludo, "enlace": enlace})
    mensaje.send(fail_silently=False)


def instrucciones_pago(medio, pago_confirmado=False, forma_entrega="retiro"):
    if pago_confirmado:
        return {
            "titulo": "Pago confirmado",
            "alias": "",
            "cvu": "",
            "titular": "",
            "mensaje": "Confirmamos el pago de tu pedido. Gracias por elegir Ragnar Suplementos.",
        }
    tienda = ConfiguracionTienda.actual()
    if medio == "transferencia":
        return {
            "titulo": "Transferencia a Personal Pay",
            "alias": tienda.valor("pago_alias", "PAGO_ALIAS"),
            "cvu": tienda.valor("pago_cvu", "PAGO_CVU"),
            "titular": tienda.valor("pago_titular", "PAGO_TITULAR"),
            "mensaje": "Una vez realizada la transferencia, envianos el comprobante por WhatsApp indicando el número de pedido.",
        }
    if forma_entrega == "envio":
        return {
            "titulo": "Pago en efectivo al recibir el envío",
            "alias": "",
            "cvu": "",
            "titular": "",
            "mensaje": tienda.valor(
                "instrucciones_efectivo_envio", "ENVIO_PAGO_EFECTIVO_INSTRUCCIONES",
                "Te contactaremos para coordinar el envío. Podés pagar en efectivo al recibirlo.",
            ),
        }
    return {
        "titulo": "Pago y retiro en el local",
        "alias": "",
        "cvu": "",
        "titular": "",
        "mensaje": tienda.valor("instrucciones_local", "LOCAL_INSTRUCCIONES", "Te contactaremos para coordinar el pago y el retiro de tu pedido."),
    }


def enviar_confirmacion_pedido(pedido, medio, pago_confirmado=False):
    instrucciones = instrucciones_pago(medio, pago_confirmado, pedido.forma_entrega)
    resumen = nombre_pedido(pedido)
    items = []
    for item in pedido.items.all():
        nombre = item.nombre + (f" ({item.sabor})" if item.sabor else "")
        items.append({"nombre": nombre, "cantidad": item.cantidad, "subtotal": _pesos(item.precio_unitario * item.cantidad)})

    datos_pago = [(etiqueta, instrucciones[clave]) for etiqueta, clave in (("Titular", "titular"), ("Alias", "alias"), ("CVU", "cvu")) if instrucciones[clave]]
    estado_texto = "confirmamos el pago de" if pago_confirmado else "recibimos"
    costo_envio = pedido.costo_envio
    productos = pedido.total - costo_envio + pedido.descuento
    detalle_entrega = "Retiro en el local"
    if pedido.forma_entrega == "envio":
        detalle_entrega = (
            f"Envío a {pedido.direccion_entrega}"
            + (f" ({pedido.distancia_envio_km} km por ruta)" if pedido.distancia_envio_km is not None else "")
        )
    lineas_texto = [f"- {i['nombre']} x{i['cantidad']}: {i['subtotal']}" for i in items]
    instrucciones_texto = "\n".join([f"{etiqueta}: {valor}" for etiqueta, valor in datos_pago] + [instrucciones["mensaje"]])
    texto = (
        f"Hola, {estado_texto} tu compra: {resumen}.\nReferencia: {pedido.id}.\n\n"
        + "\n".join(lineas_texto)
        + f"\n\nProductos: {_pesos(productos)}\n"
        + (f"Premio del juego: -{_pesos(pedido.descuento)}\n" if pedido.descuento else "")
        + f"Envío: {_pesos(costo_envio)}\nTotal: {_pesos(pedido.total)}\nEntrega: {detalle_entrega}\nMedio elegido: {instrucciones['titulo']}\n\n{instrucciones_texto}\n"
    )
    mensaje = EmailMultiAlternatives(
        subject=f"{instrucciones['titulo']}: {resumen[:160]} — Ragnar Suplementos",
        body=texto,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[pedido.email_comprador],
    )
    _con_html(mensaje, "store/emails/pedido.html", {
        "pedido": pedido, "resumen": resumen, "instrucciones": instrucciones, "estado_texto": estado_texto,
        "items": items, "datos_pago": datos_pago, "entrega": detalle_entrega, "productos": _pesos(productos),
        "descuento": _pesos(pedido.descuento) if pedido.descuento else "", "envio": _pesos(costo_envio), "total": _pesos(pedido.total),
    })
    mensaje.send(fail_silently=False)
    return settings.EMAIL_BACKEND != "django.core.mail.backends.console.EmailBackend"
