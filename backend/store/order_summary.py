"""Nombres históricos de la compra, independientes del catálogo actual."""


def datos_articulos_pedido(pedido):
    return [
        {"nombre": item.nombre, "sabor": item.sabor, "cantidad": item.cantidad,
         "precio_unitario": float(item.precio_unitario)}
        for item in pedido.items.all()
    ]


def nombre_pedido(pedido):
    items = list(pedido.items.all())
    nombres = []
    for item in items[:3]:
        nombre = " ".join(item.nombre.split())
        if item.sabor:
            nombre += f" ({' '.join(item.sabor.split())})"
        nombres.append(f"{nombre} ×{item.cantidad}")
    resumen = " + ".join(nombres) or "Compra en Ragnar"
    if len(items) > 3:
        resumen += f" + {len(items) - 3} artículo(s) más"
    return resumen
