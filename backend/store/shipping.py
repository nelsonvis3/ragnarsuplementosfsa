import hashlib
import json
import math
import os
import threading
import time
from decimal import Decimal
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

from django.core.cache import cache


class ErrorCotizacionEnvio(Exception):
    def __init__(self, mensaje, status_code=400):
        super().__init__(mensaje)
        self.status_code = status_code


_NOMINATIM_LOCK = threading.Lock()
_ROUTING_LOCK = threading.Lock()
_ULTIMA_GEOCODIFICACION = 0.0
_ULTIMA_RUTA = 0.0


def destino_formateado(direccion, barrio=""):
    partes = [direccion.strip()]
    if barrio.strip():
        partes.append(barrio.strip())
    partes.extend(["Formosa", "Formosa", "Argentina"])
    return ", ".join(partes)


def tarifas_envio():
    configuracion = os.getenv("ENVIO_TARIFAS_KM_ARS", "1:0,3:1000,5:2500,8:3500,12:5000")
    tarifas = []
    try:
        for tramo in configuracion.split(","):
            limite, costo = tramo.split(":", 1)
            tarifas.append((Decimal(limite.strip()), Decimal(costo.strip())))
        tarifas.sort(key=lambda tarifa: tarifa[0])
    except Exception as exc:
        raise ErrorCotizacionEnvio("La configuración de tarifas de envío no es válida.") from exc
    if not tarifas or any(limite <= 0 or costo < 0 for limite, costo in tarifas):
        raise ErrorCotizacionEnvio("La configuración de tarifas de envío no es válida.")
    return tarifas


def costo_envio_para_distancia(distancia_km):
    for limite, costo in tarifas_envio():
        if distancia_km <= limite:
            return costo
    return None


def _clave_cache(prefijo, valor):
    huella = hashlib.sha256(valor.casefold().strip().encode("utf-8")).hexdigest()
    return f"ragnar:envio:{prefijo}:{huella}"


def _user_agent():
    contacto = os.getenv("OSM_CONTACT_EMAIL", "").strip()
    identificador = "RagnarSuplementosEcommerce/1.0"
    return f"{identificador} (mailto:{contacto})" if contacto else identificador


def _json_de_url(url):
    request = Request(
        url,
        headers={"User-Agent": _user_agent(), "Accept": "application/json"},
    )
    try:
        with urlopen(request, timeout=10) as response:
            return json.loads(response.read().decode("utf-8"))
    except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as exc:
        raise ErrorCotizacionEnvio(
            "El calculador gratuito de rutas está ocupado. Esperá unos segundos e intentá otra vez.",
            status_code=503,
        ) from exc


def _geocodificar(direccion):
    global _ULTIMA_GEOCODIFICACION
    cache_key = _clave_cache("geocode", direccion)
    coordenadas = cache.get(cache_key)
    if coordenadas:
        return coordenadas

    with _NOMINATIM_LOCK:
        coordenadas = cache.get(cache_key)
        if coordenadas:
            return coordenadas
        espera = 1.0 - (time.monotonic() - _ULTIMA_GEOCODIFICACION)
        if espera > 0:
            time.sleep(espera)
        parametros = urlencode({"q": direccion, "format": "jsonv2", "limit": 1, "countrycodes": "ar"})
        _ULTIMA_GEOCODIFICACION = time.monotonic()
        resultados = _json_de_url(f"https://nominatim.openstreetmap.org/search?{parametros}")

        if not resultados:
            raise ErrorCotizacionEnvio("No encontramos esa dirección. Agregá calle, altura y barrio de Formosa.")
        try:
            coordenadas = (float(resultados[0]["lon"]), float(resultados[0]["lat"]))
        except (KeyError, TypeError, ValueError, IndexError) as exc:
            raise ErrorCotizacionEnvio("El servicio de mapas no devolvió una ubicación válida.") from exc
        cache.set(cache_key, coordenadas, timeout=60 * 60 * 24 * 30)
        return coordenadas


def _distancia_ruta_metros(origen, destino):
    global _ULTIMA_RUTA
    cache_key = _clave_cache("route", f"{origen[0]},{origen[1]}|{destino[0]},{destino[1]}")
    metros = cache.get(cache_key)
    if metros is not None:
        return metros

    with _ROUTING_LOCK:
        metros = cache.get(cache_key)
        if metros is not None:
            return metros
        espera = 1.0 - (time.monotonic() - _ULTIMA_RUTA)
        if espera > 0:
            time.sleep(espera)
        coordenadas = f"{origen[0]},{origen[1]};{destino[0]},{destino[1]}"
        url = f"https://routing.openstreetmap.de/routed-car/route/v1/driving/{coordenadas}?overview=false&alternatives=false&steps=false"
        _ULTIMA_RUTA = time.monotonic()
        resultado = _json_de_url(url)
        rutas = resultado.get("routes", [])
        if resultado.get("code") != "Ok" or not rutas or "distance" not in rutas[0]:
            raise ErrorCotizacionEnvio("No encontramos una ruta en auto para esa dirección de Formosa.")
        metros = int(rutas[0]["distance"])
        cache.set(cache_key, metros, timeout=60 * 60 * 24)
        return metros


def calcular_distancia_ruta_km(destino):
    origen = os.getenv("ENVIO_ORIGEN", "Azcuénaga 991, Formosa, Formosa, Argentina")
    coordenadas_origen = _geocodificar(origen)
    coordenadas_destino = _geocodificar(destino)
    metros = _distancia_ruta_metros(coordenadas_origen, coordenadas_destino)
    # Redondeamos hacia arriba a 100 m para aplicar siempre el tramo correcto.
    return Decimal(math.ceil(metros / 100) / 10).quantize(Decimal("0.1"))