# Variables y despliegue

## Variables de Django (`.env`)

La plantilla es [`.env.example`](../.env.example). No subas credenciales reales al repositorio.

| Variable | Uso |
| --- | --- |
| `DJANGO_SECRET_KEY` | Clave de Django. En producción tiene que ser larga y aleatoria |
| `DJANGO_DEBUG` | `false` en producción |
| `DJANGO_ALLOWED_HOSTS`, `DJANGO_CSRF_TRUSTED_ORIGINS` | Hosts y orígenes aceptados, separados por comas |
| `DATABASE_URL` | PostgreSQL. Sin esta variable usa `backend/db.sqlite3`, y en producción no arranca |
| `FRONTEND_URL`, `CORS_ALLOWED_ORIGIN_REGEXES` | Orígenes del frontend para CORS, retornos de pago y links de los mails |
| `PEDIDO_RESERVA_MINUTOS` | Cuánto dura la reserva de stock de un pedido. Por defecto, 1440 |
| `MP_ENABLED`, `MP_ACCESS_TOKEN`, `MP_WEBHOOK_URL`, `MP_WEBHOOK_SECRET` | Mercado Pago. Si se habilita, en producción exige las cuatro |
| `PAGO_ALIAS`, `PAGO_CVU`, `PAGO_TITULAR` | Transferencia a Personal Pay. Hace falta alias o CVU para mostrarla |
| `LOCAL_INSTRUCCIONES`, `ENVIO_PAGO_EFECTIVO_INSTRUCCIONES` | Textos para pagos en el local o al recibir |
| `ENVIO_ORIGEN`, `ENVIO_TARIFAS_KM_ARS`, `OSM_CONTACT_EMAIL` | Origen de los envíos, tarifas por tramos (`km:pesos`) y contacto para OpenStreetMap |
| `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS`, `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL` | SMTP. En desarrollo los mails salen por la terminal |
| `PASSWORD_RESET_FRONTEND_URL`, `EMAIL_CONFIRMATION_FRONTEND_URL` | Origen de los links de recuperación y confirmación. Por defecto, el primero de `FRONTEND_URL` |
| `CLOUDINARY_URL` | Cuenta de Cloudinary para las imágenes del panel |
| `DJANGO_SECURE_SSL_REDIRECT`, `DJANGO_SECURE_HSTS_SECONDS`, `DJANGO_SECURE_HSTS_INCLUDE_SUBDOMAINS`, `DJANGO_SECURE_HSTS_PRELOAD` | Redirección a HTTPS y HSTS |

El frontend usa `NEXT_PUBLIC_API_URL` en `.env.local` (plantilla: [`.env.local.example`](../.env.local.example)). Se fija al compilar, así que cambiarla exige otro build.

## Render

[`render.yaml`](../render.yaml) declara tres recursos del plan gratuito: la API Django, el sitio Next.js y una base PostgreSQL. No hay cron: las reservas vencidas se liberan cuando alguien consulta el catálogo o confirma una compra.

El build del frontend toma `DJANGO_API_HOST` y arma `NEXT_PUBLIC_API_URL` con [`scripts/render-build.mjs`](../scripts/render-build.mjs). El archivo declara un `preDeployCommand` para migrar y cargar el catálogo, pero Render solo lo ejecuta en planes pagos ([documentación de Render](https://render.com/docs/deploys#pre-deploy-command)): en el plan gratuito, las migraciones, `ensure_catalogo` y `createsuperuser` se corren desde otra máquina con `DATABASE_URL` apuntando a la base de Render.

Después del primer despliegue hay que cargar el stock real desde el panel, porque `ensure_catalogo` crea los productos con stock en cero.

## Servidor propio

```bash
python -m pip install -r requirements.txt
python backend/manage.py migrate --noinput
python backend/manage.py collectstatic --noinput
python backend/manage.py ensure_catalogo
gunicorn --chdir backend config.wsgi:application --bind 127.0.0.1:8000
```

Y para el frontend:

```bash
npm ci
npm run build
npm start -- --hostname 127.0.0.1 --port 3000
```

Los dos procesos van detrás de un proxy HTTPS que envíe `X-Forwarded-Proto`. El backend lee `public/logo.png` para los mails, así que necesita el repositorio completo.
