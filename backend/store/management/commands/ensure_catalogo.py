from django.core.management import call_command
from django.core.management.base import BaseCommand

from store.models import Producto


class Command(BaseCommand):
    help = "Carga el catálogo inicial solo si la base de datos todavía está vacía."

    def handle(self, *args, **options):
        if Producto.objects.exists():
            self.stdout.write("El catálogo ya existe; no se sobrescribió.")
            return
        call_command("seed_catalogo")
        self.stdout.write(self.style.SUCCESS("Catálogo inicial creado con stock en cero para cargar cantidades reales."))
