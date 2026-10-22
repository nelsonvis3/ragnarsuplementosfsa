"""Libera reservas periódicamente, sin depender de visitas al catálogo."""
import os
import signal
import sys
import threading
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "backend"))
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
import django
django.setup()

from django.db import close_old_connections
from store.orders import expirar_reservas_vencidas

stop = threading.Event()
signal.signal(signal.SIGTERM, lambda *_: stop.set())
signal.signal(signal.SIGINT, lambda *_: stop.set())
while not stop.is_set():
    close_old_connections()
    liberadas = expirar_reservas_vencidas()
    if liberadas:
        print(f"Reservas liberadas: {liberadas}", flush=True)
    stop.wait(60)
