from django.db import migrations, models


DESCRIPCIONES_NEUTRAS = {
    "proteina-onefit": "Producto OneFit. Consultá el rótulo oficial del envase para composición, porción e indicaciones.",
    "creatina-star-300-gramos": "Producto Star. Consultá el rótulo oficial del envase para composición, porción e indicaciones.",
    "pre-entreno-onefit-300-gramos": "Producto OneFit. Consultá el rótulo oficial del envase para composición, porción e indicaciones.",
    "citrato-de-magnesio-star-60-capsulas": "Producto Star. Consultá el rótulo oficial del envase para composición, porción e indicaciones.",
    "proteina-star": "Producto Star. Consultá el rótulo oficial del envase para composición, porción e indicaciones.",
    "omega-3-onefit-30-capsulas": "Producto OneFit. Consultá el rótulo oficial del envase para composición, porción e indicaciones.",
    "creatina-onefit-micronizada-200g": "Producto OneFit. Consultá el rótulo oficial del envase para composición, porción e indicaciones.",
    "caffeine-200-star-30-capsulas": "Producto Star. Consultá el rótulo oficial del envase para composición, porción e indicaciones.",
    "pancakes-400g": "Producto alimenticio. Consultá el rótulo oficial del envase para ingredientes e información nutricional.",
    "colageno-onefit-240g": "Producto OneFit. Consultá el rótulo oficial del envase para composición, porción e indicaciones.",
    "colageno-hydroflex-xbody-330-gramos": "Producto Xbody. Consultá el rótulo oficial del envase para composición, porción e indicaciones.",
    "mutantmass-star-1-5kg": "Producto Star. Consultá el rótulo oficial del envase para composición, porción e indicaciones.",
    "creatina-onefit-500g": "Producto OneFit. Consultá el rótulo oficial del envase para composición, porción e indicaciones.",
    "pasta-de-mani-entrenuts-370g": "Producto alimenticio. Consultá el rótulo oficial del envase para ingredientes e información nutricional.",
}


def limpiar_descripciones(apps, schema_editor):
    Producto = apps.get_model("store", "Producto")
    for slug, descripcion in DESCRIPCIONES_NEUTRAS.items():
        Producto.objects.filter(slug=slug).update(descripcion=descripcion)


class Migration(migrations.Migration):
    dependencies = [("store", "0004_pedido_datos_envio")]

    operations = [
        migrations.AddField(
            model_name="pedido",
            name="nombre_comprador",
            field=models.CharField(default="", max_length=150),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="pedido",
            name="telefono_comprador",
            field=models.CharField(default="", max_length=30),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name="pedido",
            name="stock_reservado_hasta",
            field=models.DateTimeField(blank=True, db_index=True, null=True),
        ),
        migrations.AddField(
            model_name="itempedido",
            name="componentes_combo",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.CreateModel(
            name="SolicitudAtencion",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("tipo", models.CharField(choices=[("arrepentimiento", "Arrepentimiento"), ("reclamo", "Reclamo"), ("consulta", "Consulta")], db_index=True, max_length=20)),
                ("nombre", models.CharField(max_length=150)),
                ("email", models.EmailField(max_length=254)),
                ("telefono", models.CharField(blank=True, max_length=30)),
                ("numero_pedido", models.CharField(blank=True, max_length=30)),
                ("mensaje", models.TextField(blank=True, max_length=3000)),
                ("estado", models.CharField(choices=[("pendiente", "Pendiente"), ("en_proceso", "En proceso"), ("resuelta", "Resuelta")], db_index=True, default="pendiente", max_length=12)),
                ("creado", models.DateTimeField(auto_now_add=True)),
            ],
            options={"ordering": ["-creado"], "verbose_name": "solicitud de atención", "verbose_name_plural": "solicitudes de atención"},
        ),
        migrations.RunPython(limpiar_descripciones, migrations.RunPython.noop),
    ]
