from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("store", "0003_pedido_stock_reservado"),
    ]

    operations = [
        migrations.AddField(
            model_name="pedido",
            name="forma_entrega",
            field=models.CharField(
                choices=[("retiro", "Retiro en el local"), ("envio", "Envío a domicilio")],
                default="retiro",
                max_length=10,
            ),
        ),
        migrations.AddField(
            model_name="pedido",
            name="direccion_entrega",
            field=models.CharField(blank=True, max_length=300),
        ),
        migrations.AddField(
            model_name="pedido",
            name="distancia_envio_km",
            field=models.DecimalField(blank=True, decimal_places=1, max_digits=7, null=True),
        ),
        migrations.AddField(
            model_name="pedido",
            name="costo_envio",
            field=models.DecimalField(decimal_places=2, default=0, max_digits=12),
        ),
    ]
