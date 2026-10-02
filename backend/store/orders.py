import logging

from django.utils import timezone
from django.db import transaction

from .emails import enviar_confirmacion_pedido
from .models import Pedido, Producto

logger = logging.getLogger(__name__)


def expirar_reserva_pedido(pedido_id):
    """Cancela una reserva manual vencida y devuelve las unidades al inventario."""
    with transaction.atomic():
        pedido = Pedido.objects.select_for_update().filter(
            pk=pedido_id,
            estado="pendiente",
            proveedor_pago__in=("mercado_pago", "transferencia", "local"),
            stock_reservado=True,
            stock_reservado_hasta__lte=timezone.now(),
        ).first()
        if not pedido:
            return False
        cantidades = _cantidades_del_pedido(pedido)
        productos = list(Producto.objects.select_for_update().filter(pk__in=cantidades).order_by("id"))
        if len(productos) != len(cantidades):
            logger.error("No se pudo liberar stock del pedido %s: falta un producto.", pedido_id)
            return False
        for producto in productos:
            producto.stock += cantidades[producto.id]
            producto.save(update_fields=["stock", "actualizado"])
        pedido.estado = "cancelado"
        pedido.stock_reservado = False
        pedido.stock_reservado_hasta = None
        pedido.save(update_fields=["estado", "stock_reservado", "stock_reservado_hasta", "actualizado"])
        return True


def _cantidades_del_pedido(pedido):
    cantidades = {}
    for item in pedido.items.select_related("producto", "combo"):
        if item.producto_id:
            cantidades[item.producto_id] = cantidades.get(item.producto_id, 0) + item.cantidad
        else:
            componentes = item.componentes_combo
            if not componentes and item.combo_id:
                componentes = list(item.combo.productos.values_list("id", flat=True))
            for producto_id in componentes:
                cantidades[producto_id] = cantidades.get(producto_id, 0) + item.cantidad
    return cantidades


def procesar_pedido_manual(pedido_id, accion):
    """Aprueba un pago manual o cancela el pedido y libera el stock reservado."""
    correo_pedido = None
    with transaction.atomic():
        pedido = Pedido.objects.select_for_update().filter(pk=pedido_id).first()
        if not pedido:
            return False, "El pedido ya no existe."
        if pedido.proveedor_pago not in ("transferencia", "local"):
            return False, "Este pedido no usa un medio de pago manual."
        if pedido.estado != "pendiente":
            return False, f"El pedido ya está {pedido.get_estado_display().lower()}."
        if pedido.stock_reservado and pedido.stock_reservado_hasta and pedido.stock_reservado_hasta <= timezone.now():
            cantidades = _cantidades_del_pedido(pedido)
            productos = list(Producto.objects.select_for_update().filter(pk__in=cantidades).order_by("id"))
            if len(productos) != len(cantidades):
                return False, "Falta un producto asociado al pedido; revisá el pedido manualmente."
            for producto in productos:
                producto.stock += cantidades[producto.id]
                producto.save(update_fields=["stock", "actualizado"])
            pedido.estado = "cancelado"
            pedido.stock_reservado = False
            pedido.stock_reservado_hasta = None
            pedido.save(update_fields=["estado", "stock_reservado", "stock_reservado_hasta", "actualizado"])
            return False, "La reserva venció; el pedido se canceló y el stock fue liberado."
        if accion not in ("aprobar", "cancelar"):
            return False, "Acción de pedido desconocida."

        cantidades = _cantidades_del_pedido(pedido)
        productos = list(
            Producto.objects.select_for_update().filter(pk__in=cantidades).order_by("id")
        )
        if len(productos) != len(cantidades):
            return False, "Falta un producto asociado al pedido; revisá el pedido manualmente."

        if accion == "aprobar":
            if not pedido.stock_reservado:
                if any(producto.stock < cantidades[producto.id] for producto in productos):
                    pedido.estado = "revisar_stock"
                    pedido.save(update_fields=["estado", "actualizado"])
                    return False, "No hay stock suficiente; el pedido pasó a revisión."
                for producto in productos:
                    producto.stock -= cantidades[producto.id]
                    producto.save(update_fields=["stock", "actualizado"])
            pedido.estado = "aprobado"
            pedido.stock_reservado = False
            pedido.stock_reservado_hasta = None
            pedido.save(update_fields=["estado", "stock_reservado", "stock_reservado_hasta", "actualizado"])
            correo_pedido = pedido
        else:
            if pedido.stock_reservado:
                for producto in productos:
                    producto.stock += cantidades[producto.id]
                    producto.save(update_fields=["stock", "actualizado"])
            pedido.estado = "cancelado"
            pedido.stock_reservado = False
            pedido.stock_reservado_hasta = None
            pedido.save(update_fields=["estado", "stock_reservado", "stock_reservado_hasta", "actualizado"])

    if correo_pedido:
        try:
            enviar_confirmacion_pedido(
                correo_pedido,
                correo_pedido.proveedor_pago,
                pago_confirmado=True,
            )
        except Exception:
            logger.exception("No se pudo enviar el correo de pago confirmado del pedido %s", pedido_id)
    return True, "Pedido actualizado."


def completar_pedido_mercado_pago(pedido_id):
    """Completa un pedido ya pagado que quedó esperando reposición de stock."""
    correo_pedido = None
    with transaction.atomic():
        pedido = Pedido.objects.select_for_update().filter(
            pk=pedido_id,
            proveedor_pago="mercado_pago",
            estado="revisar_stock",
        ).first()
        if not pedido:
            return False, "El pedido no está pendiente de revisión de stock."
        cantidades = _cantidades_del_pedido(pedido)
        productos = list(Producto.objects.select_for_update().filter(pk__in=cantidades).order_by("id"))
        if len(productos) != len(cantidades):
            return False, "Falta un producto asociado; revisá el pedido antes de completarlo."
        if any(producto.stock < cantidades[producto.id] for producto in productos):
            return False, "Reponé el inventario de los productos del pedido antes de completarlo."
        for producto in productos:
            producto.stock -= cantidades[producto.id]
            producto.save(update_fields=["stock", "actualizado"])
        pedido.estado = "aprobado"
        pedido.save(update_fields=["estado", "actualizado"])
        correo_pedido = pedido

    try:
        enviar_confirmacion_pedido(correo_pedido, "mercado_pago", pago_confirmado=True)
    except Exception:
        logger.exception("No se pudo enviar el correo de pago confirmado del pedido %s", pedido_id)
    return True, "Pedido completado. El pago ya estaba aprobado; el inventario fue descontado."


def resolver_revision_pago(pedido_id, estado_final):
    """Cierra una revisión después de verificar manualmente el estado en Mercado Pago."""
    if estado_final not in ("cancelado", "reembolsado"):
        return False, "Estado de cierre desconocido."
    with transaction.atomic():
        estados_resolubles = ("revision_pago", "revisar_stock") if estado_final == "reembolsado" else ("revision_pago",)
        pedido = Pedido.objects.select_for_update().filter(
            pk=pedido_id,
            proveedor_pago="mercado_pago",
            estado__in=estados_resolubles,
        ).first()
        if not pedido:
            return False, "El pedido no está en revisión de pago."
        if estado_final == "reembolsado" and not pedido.pago_id:
            return False, "No hay un pago asociado al pedido para marcarlo como reembolsado."
        if pedido.stock_reservado:
            cantidades = _cantidades_del_pedido(pedido)
            productos = list(Producto.objects.select_for_update().filter(pk__in=cantidades).order_by("id"))
            if len(productos) != len(cantidades):
                return False, "Falta un producto asociado; revisá el inventario manualmente."
            for producto in productos:
                producto.stock += cantidades[producto.id]
                producto.save(update_fields=["stock", "actualizado"])
        pedido.estado = estado_final
        pedido.stock_reservado = False
        pedido.stock_reservado_hasta = None
        pedido.save(update_fields=["estado", "stock_reservado", "stock_reservado_hasta", "actualizado"])
    return True, f"Revisión cerrada como {pedido.get_estado_display().lower()}."
