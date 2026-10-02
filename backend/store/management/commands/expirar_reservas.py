from django.core.management.base import BaseCommand
from django.utils import timezone

from store.models import Pedido
from store.orders import expirar_reserva_pedido


class Command(BaseCommand):
    help = "Cancela pedidos pendientes vencidos y libera el stock reservado."

    def handle(self, *args, **options):
        ids = list(
            Pedido.objects.filter(
                estado="pendiente",
                proveedor_pago__in=("mercado_pago", "transferencia", "local"),
                stock_reservado=True,
                stock_reservado_hasta__lte=timezone.now(),
            ).values_list("id", flat=True)
        )
        expirados = sum(expirar_reserva_pedido(pedido_id) for pedido_id in ids)
        self.stdout.write(self.style.SUCCESS(f"Reservas vencidas liberadas: {expirados}."))
