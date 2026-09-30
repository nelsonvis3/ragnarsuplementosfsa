from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("store", "0001_initial"),
    ]

    operations = [
        migrations.AlterField(
            model_name="pedido",
            name="proveedor_pago",
            field=models.CharField(
                choices=[
                    ("mercado_pago", "Mercado Pago"),
                    ("transferencia", "Transferencia Personal Pay"),
                    ("local", "Pago en el local"),
                ],
                default="mercado_pago",
                max_length=30,
            ),
        ),
    ]
