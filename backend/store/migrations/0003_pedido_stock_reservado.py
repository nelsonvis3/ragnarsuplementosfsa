from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("store", "0002_pedido_medio_pago_choices"),
    ]

    operations = [
        migrations.AddField(
            model_name="pedido",
            name="stock_reservado",
            field=models.BooleanField(default=False),
        ),
    ]
