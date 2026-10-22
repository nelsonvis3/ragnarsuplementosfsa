# Ragnar en VPS con Docker y Nginx

Esta configuración queda como guía para el despliegue manual a cargo de Nelson. **No se ejecutó ningún despliegue público ni push.** Los comandos siguientes corresponden a esa etapa posterior.

## Arquitectura

Nginx expone únicamente 80/443. Next.js, Gunicorn, PostgreSQL y Redis quedan en la red privada de Compose, sin puertos publicados. `/api/` llega a Django sin el prefijo; `/admin/` y `/static/` llegan a Django; el resto llega a Next.js. El panel de la tienda sigue en `/administracion`.

Next.js usa `/api` desde el navegador y `http://api:8000` desde el servidor. Esto evita usar localhost o una URL relativa durante el renderizado del detalle. El tráfico interno del servidor indica HTTPS a Django; solo Nginx debe tener acceso público. Redis comparte los límites de solicitudes y la caché de envíos entre workers. El proceso `reservations` libera reservas vencidas cada minuto.

## Antes de publicar

- Hacer el push y elegir el commit que se va a desplegar manualmente.
- Tener un VPS Linux con Docker Engine y Compose v2, un dominio y registros DNS A apuntando al VPS. Esta configuración escucha IPv4; no publicar un registro AAAA sin adaptar y probar IPv6.
- Abrir 80/443; mantener SSH bajo el acceso administrado del proveedor. No publicar 5432, 6379, 8000 ni 3000.
- Clonar el commit revisado. Registrar el commit y la versión de las imágenes utilizadas. Las etiquetas base deben actualizarse y probarse regularmente.
- Si hay datos existentes, respaldar y planificar su importación antes de crear otra tienda vacía. No ejecutar `seed_catalogo` sobre el catálogo operativo.

## Secretos y Gmail

Copiar `.env.production.example` a `.env.production`, dar permisos `600` y completar `DOMAIN`, `POSTGRES_PASSWORD`, `DJANGO_SECRET_KEY`, `EMAIL_HOST_PASSWORD` y `CLOUDINARY_URL`. Para las dos claves del sistema, ejecutar `openssl rand -hex 32` por separado. La contraseña de PostgreSQL debe ser hexadecimal para no requerir escape en la URL.

El remitente preparado es **Ragnar Suplementos <nelsonsivisstum3@gmail.com>**, con `smtp.gmail.com:465`, SSL habilitado y STARTTLS deshabilitado. Google requiere verificación en dos pasos para crear una [contraseña de aplicación](https://support.google.com/mail/answer/185833?hl=es). Guardar esa contraseña únicamente en `EMAIL_HOST_PASSWORD`, sin espacios; no usar la contraseña habitual de la cuenta ni subirla a Git. Los enlaces de correo se generan con el dominio HTTPS configurado.

El correo de registro contiene el nombre del cliente, la identidad roja y oscura de Ragnar, logo adjunto y enlace de confirmación de 24 horas. Hasta confirmar, la cuenta queda inactiva. Abrir el enlace confirma e inicia sesión automáticamente. La recuperación utiliza un enlace de una hora y revoca las sesiones tras cambiar la contraseña. Los envíos reales y su llegada a Gmail deben comprobarse en la puesta en marcha; una prueba con buzón local no demuestra entregabilidad ni ausencia de spam.

`ATENCION_EMAIL=adansiv16@gmail.com` recibe las consultas del formulario de asesoramiento. Se envían desde el Gmail configurado y permiten responder al email del cliente. Ante una falla SMTP, revisar las solicitudes guardadas en Django Admin y los avisos del log: no se reintentan automáticamente.

Las imágenes nuevas requieren Cloudinary. Los productos existentes conservan sus rutas locales. Las credenciales comerciales y de pagos quedan vacías: no se inventan alias, CVU ni claves de Mercado Pago.

## Preparación y primer certificado

Desde la raíz del repositorio, después de la autorización:

```bash
docker compose --env-file .env.production config --quiet
docker compose --env-file .env.production build --pull
NGINX_TEMPLATE=http.conf.template docker compose --env-file .env.production up -d
docker compose --env-file .env.production ps -a
```

El inicio HTTP solo atiende desafíos ACME; la tienda devuelve 503 hasta activar HTTPS. El servicio `migrate` debe finalizar con código 0. La API y la web esperan sus comprobaciones de salud.

Reemplazar los valores de este comando por el dominio real y el email del titular:

```bash
docker compose --env-file .env.production run --rm certbot certonly --webroot -w /var/www/certbot --email nelsonsivisstum3@gmail.com --agree-tos --no-eff-email -d DOMINIO_REAL
docker compose --env-file .env.production up -d --force-recreate nginx
docker compose --env-file .env.production exec nginx nginx -t
docker compose --env-file .env.production exec api python manage.py check --deploy
docker compose --env-file .env.production exec api python manage.py createsuperuser
```

Solo si es una base nueva que debe recibir el catálogo inicial:

```bash
docker compose --env-file .env.production exec api python manage.py ensure_catalogo
```

El catálogo inicial tiene stock cero. Cargar cantidades reales desde el panel antes de vender. No crear pedidos ni ventas ficticias para llenar el ranking de producción.

## Validación pública pendiente

Comprobar HTTPS y redirección HTTP, `/api/health/`, detalle de productos, sesión administrativa, creación de categoría y publicación de un artículo. Registrar una cuenta de prueba propia, comprobar el correo en Gmail, consumir el enlace y probar recuperación. En una compra de prueba controlada, verificar precios, reserva, confirmación/cancelación y stock. No usar tarjetas o pagos reales sin acordarlo.

Si se habilita Mercado Pago, configurar `MP_ENABLED=true`, token, secreto de webhook y `MP_WEBHOOK_URL=https://DOMINIO_REAL/api/pagos/webhook`. Verificar notificaciones y retornos con credenciales de prueba antes de operar. Los tests locales simulan el proveedor.

Tras comprobar HTTPS estable, establecer `DJANGO_SECURE_HSTS_SECONDS=31536000` y recrear la API. Las advertencias por HSTS desactivado son esperables durante el alta; no habilitar `includeSubDomains` o `preload` sin controlar todos los subdominios.

## Renovación, backups y actualizaciones

Programar `bash /RUTA/DEL/REPO/deploy/renew-certificates.sh` dos veces al día en el cron del VPS. Probar antes:

```bash
docker compose --env-file .env.production run --rm certbot renew --dry-run
bash deploy/backup.sh
```

El respaldo se guarda con permisos privados en `deploy/backups`, excluido de Git y de las imágenes. Conservar copias cifradas fuera del VPS y respaldar también la configuración secreta y la cuenta de Cloudinary. La restauración debe probarse en una base separada, por ejemplo `ragnar_restore_check`, mediante `createdb` y `pg_restore --no-owner`; comparar registros y ejecutar pruebas antes de considerar válido el respaldo. No restaurar sobre la base operativa como ensayo.

Para actualizar: respaldar, traer el commit acordado, construir imágenes, detener `nginx`, `web`, `api` y `reservations`, ejecutar las migraciones y volver a iniciar. Este procedimiento tiene una ventana de mantenimiento:

```bash
bash deploy/backup.sh
docker compose --env-file .env.production build --pull
docker compose --env-file .env.production stop nginx web api reservations
docker compose --env-file .env.production run --rm migrate
docker compose --env-file .env.production up -d
docker compose --env-file .env.production ps -a
```

No ejecutar `docker compose down -v`: elimina los volúmenes de datos y certificados. Volver a una imagen anterior no revierte una migración; ante incompatibilidad, restaurar el respaldo dentro de una intervención planificada. Los logs rotan a 3 archivos de 10 MB por servicio. Revisar salud, disco libre, fallos SMTP y trabajos de reservas.

## Referencias de configuración

- [Next.js: self-hosting](https://nextjs.org/docs/app/guides/self-hosting) y [salida standalone](https://nextjs.org/docs/app/api-reference/config/next-config-js/output).
- [Django: envío de correo](https://docs.djangoproject.com/en/6.0/topics/email/) y [checklist de despliegue](https://docs.djangoproject.com/en/6.0/howto/deployment/checklist/).
