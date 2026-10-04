from django.core.management.base import BaseCommand
from store.orders import expirar_reservas_vencidas


class Command(BaseCommand):
    help = "Cancela pedidos pendientes vencidos y libera el stock reservado."

    def handle(self, *args, **options):
        expirados = expirar_reservas_vencidas()
        self.stdout.write(self.style.SUCCESS(f"Reservas vencidas liberadas: {expirados}."))
