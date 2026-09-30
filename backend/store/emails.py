import os
from html import escape

from django.conf import settings
from django.core.mail import EmailMultiAlternatives


def instrucciones_pago(medio, pago_confirmado=False, forma_entrega="retiro"):
    if pago_confirmado:
        return {
            "titulo": "Pago confirmado",
            "alias": "",
            "cvu": "",
            "titular": "",
            "mensaje": "Confirmamos el pago de tu pedido. Gracias por elegir Ragnar Suplementos.",
        }
    if medio == "transferencia":
        return {
            "titulo": "Transferencia a Personal Pay",
            "alias": os.getenv("PAGO_ALIAS", ""),
            "cvu": os.getenv("PAGO_CVU", ""),
            "titular": os.getenv("PAGO_TITULAR", ""),
            "mensaje": "Una vez realizada la transferencia, envianos el comprobante por WhatsApp indicando el número de pedido.",
        }
    if forma_entrega == "envio":
        return {
            "titulo": "Pago en efectivo al recibir el envío",
            "alias": "",
            "cvu": "",
            "titular": "",
            "mensaje": os.getenv(
                "ENVIO_PAGO_EFECTIVO_INSTRUCCIONES",
                "Te contactaremos para coordinar el envío. Podés pagar en efectivo al recibirlo.",
            ),
        }
    return {
        "titulo": "Pago y retiro en el local",
        "alias": "",
        "cvu": "",
        "titular": "",
        "mensaje": os.getenv("LOCAL_INSTRUCCIONES", "Te contactaremos para coordinar el pago y el retiro de tu pedido."),
    }


def enviar_confirmacion_pedido(pedido, medio, pago_confirmado=False):
    instrucciones = instrucciones_pago(medio, pago_confirmado, pedido.forma_entrega)
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:3000").split(",")[0].rstrip("/")
    logo_url = f"{frontend_url}/logo.png"
    nombre_medio = escape(instrucciones["titulo"])
    lineas_texto = []
    lineas_html = []
    for item in pedido.items.all():
        nombre = item.nombre + (f" ({item.sabor})" if item.sabor else "")
        subtotal = item.precio_unitario * item.cantidad
        lineas_texto.append(f"- {nombre} x{item.cantidad}: ${subtotal:,.0f}")
        lineas_html.append(
            f"<li style='padding:8px 0;border-bottom:1px solid #333'>{escape(nombre)} × {item.cantidad} — ${subtotal:,.0f}</li>"
        )

    datos_transferencia = []
    for etiqueta, clave in (("Titular", "titular"), ("Alias", "alias"), ("CVU", "cvu")):
        if instrucciones[clave]:
            datos_transferencia.append(f"{etiqueta}: {instrucciones[clave]}")
    instrucciones_texto = "\n".join(datos_transferencia + [instrucciones["mensaje"]])
    instrucciones_html = "".join(
        f"<p><strong>{escape(etiqueta)}:</strong> {escape(instrucciones[clave])}</p>"
        for etiqueta, clave in (("Titular", "titular"), ("Alias", "alias"), ("CVU", "cvu"))
        if instrucciones[clave]
    ) + f"<p>{escape(instrucciones['mensaje'])}</p>"
    estado_texto = "confirmamos el pago de" if pago_confirmado else "recibimos"
    costo_envio = pedido.costo_envio
    subtotal = pedido.total - costo_envio
    detalle_entrega = "Retiro en el local"
    if pedido.forma_entrega == "envio":
        detalle_entrega = (
            f"Envío a {pedido.direccion_entrega}"
            + (f" ({pedido.distancia_envio_km} km por ruta)" if pedido.distancia_envio_km is not None else "")
        )
    texto = (
        f"Hola, {estado_texto} tu pedido #{pedido.id}.\n\n"
        + "\n".join(lineas_texto)
        + f"\n\nProductos: ${subtotal:,.0f}\nEnvío: ${costo_envio:,.0f}\nTotal: ${pedido.total:,.0f}\nEntrega: {detalle_entrega}\nMedio elegido: {instrucciones['titulo']}\n\n{instrucciones_texto}\n"
    )
    html = f"""
    <div style="margin:0;background:#111;color:#f5f0e8;padding:32px;font-family:Arial,sans-serif">
      <div style="max-width:560px;margin:auto;background:#1b1b1b;border:1px solid #333;padding:28px">
        <img src="{escape(logo_url)}" alt="Ragnar Suplementos" width="140" style="display:block;margin:0 auto 24px;max-height:90px;object-fit:contain">
        <h1 style="color:#f3a712;font-size:24px">{escape(instrucciones['titulo'])}: pedido #{pedido.id}</h1>
        <p>{escape(instrucciones['mensaje'])}</p>
        <ul style="padding-left:18px">{''.join(lineas_html)}</ul>
        <p style="font-size:18px"><strong>Total:</strong> ${pedido.total:,.0f}</p>
        <p><strong>Productos:</strong> ${subtotal:,.0f}</p>
        <p><strong>Envío:</strong> ${costo_envio:,.0f}</p>
        <p><strong>Entrega:</strong> {escape(detalle_entrega)}</p>
        <h2 style="font-size:17px">{nombre_medio}</h2>
        {instrucciones_html}
      </div>
    </div>
    """
    mensaje = EmailMultiAlternatives(
        subject=f"{instrucciones['titulo']}: pedido #{pedido.id} — Ragnar Suplementos",
        body=texto,
        from_email=settings.DEFAULT_FROM_EMAIL,
        to=[pedido.email_comprador],
    )
    mensaje.attach_alternative(html, "text/html")
    mensaje.send(fail_silently=False)
    return settings.EMAIL_BACKEND != "django.core.mail.backends.console.EmailBackend"
