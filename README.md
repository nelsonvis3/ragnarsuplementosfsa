# Ragnar Suplementos

Tienda online con frontend Next.js y API Django REST. Django administra el catálogo, el stock, los pedidos y los pagos. PostgreSQL es la base prevista para producción; SQLite puede usarse para desarrollo si no se configura `DATABASE_URL`.

## Requisitos

- Node.js 20.9 o posterior y npm.
- Python 3.12 o posterior.
- PostgreSQL para desarrollar con la misma base que producción.

## Desarrollo local

### Backend

Desde la raíz, copia `.env.example` a `.env` y configura `DATABASE_URL` con tu base PostgreSQL local. No subas `.env` ni compartas sus credenciales. Ejemplo de URL (reemplaza usuario y contraseña localmente):

```text
DATABASE_URL=postgresql://ragnar_user:TU_CLAVE@127.0.0.1:5432/ragnar_db
```

En Fish, desde `backend/`:

```fish
python -m venv .venv
source .venv/bin/activate.fish
python -m pip install -r ../requirements.txt
python manage.py migrate
python manage.py ensure_catalogo
python manage.py createsuperuser
python manage.py runserver
```

La API queda disponible en `http://127.0.0.1:8000`. La carga inicial crea productos con stock cero; carga las cantidades reales en `/admin/` antes de aceptar pedidos.

### Frontend

En otra terminal, desde la raíz:

```bash
npm ci
npm run dev
```

El sitio queda disponible en `http://localhost:3000`. Para cambiar la URL de la API, copia `.env.local.example` a `.env.local` y establece `NEXT_PUBLIC_API_URL`.

## Despliegue en Render

El archivo `render.yaml` define el frontend Next.js, la API Django, PostgreSQL y el cron que libera reservas vencidas. Conecta el repositorio de GitHub en Render y crea un Blueprint a partir de ese archivo.

Render crea la base PostgreSQL y la clave secreta de Django. Antes de habilitar ventas, configura en el servicio API las credenciales que vayas a usar: Mercado Pago (`MP_ACCESS_TOKEN`, `MP_ENABLED`, `MP_WEBHOOK_SECRET`, `MP_WEBHOOK_URL`), correo SMTP, Cloudinary y datos de transferencia. Mercado Pago permanece deshabilitado mientras `MP_ENABLED` no sea `true`.

Después del primer despliegue, crea un superusuario desde la consola del servicio API con `python manage.py createsuperuser`, entra a `/admin/` y carga el stock real. `ensure_catalogo` crea el catálogo inicial con stock cero si la base está vacía.

## Variables y secretos

- `.env.example`: plantilla local para Django. Completa solo las integraciones que uses.
- `.env.local.example`: plantilla local para Next.js.
- En Render, configura secretos desde el panel de Environment. Nunca subas archivos `.env`, claves privadas, credenciales de pago ni contraseñas de bases de datos.
