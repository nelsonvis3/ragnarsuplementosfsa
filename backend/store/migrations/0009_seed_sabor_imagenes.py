from django.db import migrations


IMAGENES_SABORES = {
    "creatina-star-300-gramos": {
        "Frutos Rojos": "/productos-img/creatinas/creatina-star/frutosrojos.png",
    },
    "proteina-star": {
        "Frutilla": "/productos-img/proteinas/proteina-star/protestarfrutilla.png",
    },
    "pancakes-400g": {
        "Chocolate": "/productos-img/alimentos/pancakes-chocolate.png",
    },
    "pasta-de-mani-entrenuts-370g": {
        "Caramelo Salado": "/productos-img/alimentos/pasta-cokacream-caramelo-salado.png",
    },
}


def corregir_imagenes_sabores(apps, schema_editor):
    Producto = apps.get_model("store", "Producto")
    for slug, imagenes in IMAGENES_SABORES.items():
        producto = Producto.objects.filter(slug=slug).first()
        if not producto or not isinstance(producto.sabores, list):
            continue
        sabores = []
        hubo_cambios = False
        for sabor in producto.sabores:
            if isinstance(sabor, dict) and sabor.get("nombre") in imagenes:
                sabor = {**sabor, "imagen": imagenes[sabor["nombre"]]}
                hubo_cambios = True
            sabores.append(sabor)
        if hubo_cambios:
            producto.sabores = sabores
            producto.save(update_fields=["sabores"])


class Migration(migrations.Migration):
    dependencies = [("store", "0008_pedido_checkout_key_pedido_checkout_payload_hash_and_more")]

    operations = [migrations.RunPython(corregir_imagenes_sabores, migrations.RunPython.noop)]
