# Despliegue de prueba a costo cero: Render + Neon

Esta receta publica la aplicación **Full Stack** con dos servicios web gratuitos de Render (Next.js y Django) y PostgreSQL gratuito de Neon. Se usa la rama `feature/ragnar-free-demo` hasta verificarla y fusionarla a `main`.

> **Solo demostración.** Render Free duerme después de 15 minutos sin tráfico, puede tardar aproximadamente un minuto en reactivarse y no ofrece acceso Shell, discos persistentes ni tareas predeploy. Ambos servicios comparten 750 horas gratuitas por mes de workspace. No usar para compradores reales ni habilitar pagos reales hasta pasar a infraestructura apta para producción.
>
> **Costos:** cero mientras se mantengan los planes gratuitos y sus cuotas. Sin método de pago, Render puede suspender servicios al alcanzar límites, en lugar de cobrarte. Comprobá el plan antes de confirmar.

## 1. Crear PostgreSQL gratuito en Neon

1. Abrí https://console.neon.tech e ingresá con tu cuenta.
2. Creá un proyecto `ragnar-demo` en el plan Free. La región estadounidense más cercana a Ohio puede reducir latencia.
3. En la pantalla **Connect** copiá la URL completa de PostgreSQL (cadena `postgresql://...` con `sslmode=require`; mantené el resto de los parámetros que te entregue Neon).
4. **No publiques la URL** en GitHub, capturas, issues ni en el chat; lleva una contraseña.

No crear la base de datos `ragnar-db` en Render: la instancia Free de PostgreSQL de Render **expira a los 30 días**. Neon Free ofrece 1 GB de almacenamiento por proyecto según la actualización de octubre de 2026.

## 2. Crear los dos servicios Free en Render

1. Abrí https://dashboard.render.com y conectá GitHub con permisos para `nelsonvis3/ragnarsuplementosfsa`.
2. En Render seleccioná **New → Blueprint**.
3. Elegí el repositorio y `main` **después** de fusionar esta rama. Render leerá `render.yaml`.
4. Revisá que se creen **únicamente dos Web Services**: `ragnar-api` (Python Free) y `ragnar-web` (Node Free), ambos `$0`. **No crear Render Postgres**.
5. Render solicitará `DATABASE_URL` para `ragnar-api`: pegá ahí la cadena secreta de Neon. No la incluyas en `render.yaml`.
6. Iniciá el Blueprint y supervisá **Events / Logs** de los dos servicios.

`render.yaml` obtiene automáticamente `RENDER_EXTERNAL_HOSTNAME` del backend para compilar Next.js y `RENDER_EXTERNAL_URL` del frontend para configurar CORS y los vínculos de emails. El script `scripts/render-build.mjs` inyecta `NEXT_PUBLIC_API_URL` en el build.

**Importante:** Render Free no admite `preDeployCommand` ni Shell remoto. Por eso, el start de `ragnar-api` ejecuta `migrate` y `ensure_catalogo` **antes** de iniciar Gunicorn. `ensure_catalogo` no vuelve a sembrar productos si ya existe un catálogo. Este enfoque es práctico para una sola instancia de demostración, pero no es el esquema recomendable para producción.

## 3. Verificar el despliegue

- `https://ragnar-api.onrender.com/health/` debe responder con `status: ok` (la URL puede tener un sufijo si Render asigna otro nombre).
- `https://ragnar-api.onrender.com/productos/` debe responder con JSON de productos.
- Abrí la URL HTTPS que Render asignó a `ragnar-web`. Comprobá catálogo, combos, formulario de asesoramiento y la página `/carrito`.
- El stock inicial del catálogo se carga en **cero**, por seguridad. Hasta que configures inventario no podrás completar compras.

## 4. Crear un superusuario en Neon desde tu PC

Render Free no tiene Shell. Podés ejecutar el comando Django en la máquina de desarrollo conectándolo temporalmente a Neon:

1. Usá la carpeta original Full Stack con Python y dependencias instaladas (`pip install -r requirements.txt`).
2. En **Fish**, con el entorno virtual Python ya activado, ejecutá:

```fish
read --silent --prompt-str "URL privada de Neon: " NEON_DATABASE_URL
env DATABASE_URL="$NEON_DATABASE_URL" python backend/manage.py createsuperuser
set --erase NEON_DATABASE_URL
```

El comando usa Neon, no SQLite. No pegues el secreto directamente en un comando ni lo incluyas en el historial.

3. Entrá al panel Next.js `/administracion` con las credenciales de esa cuenta. No compartas credenciales reales ni las insertes en `render.yaml`.

## 5. Funciones que necesitan configuración extra

- **Email real con Resend:** Render Free bloquea SMTP saliente en los puertos 25, 465 y 587. El Blueprint usa `store.email_backend.ResendEmailBackend`, que envía a la API HTTPS de Resend. Creá una cuenta Free en https://resend.com, verificá un dominio de envío y configurá en el backend de Render `RESEND_API_KEY` (secreto) y `DEFAULT_FROM_EMAIL` (por ejemplo `Ragnar Suplementos <cuentas@tu-dominio-verificado.com>`). El plan gratuito de Resend actualmente incluye 3.000 emails mensuales, máximo 100 por día. **Sin dominio verificado, Resend puede limitarte a enviarte correos únicamente a tu email de cuenta para pruebas.** Sin las credenciales, la cuenta queda pendiente y el formulario avisa de que no se pudo enviar; no habilites registro público hasta terminar esta configuración. En local, Django sigue usando consola por defecto: el enlace aparece en la terminal del backend, no en Gmail.
- **Fotos desde el panel:** para subir nuevas imágenes, creá una cuenta Cloudinary Free y cargá `CLOUDINARY_URL` en el entorno del backend de Render. Las imágenes ya incluidas en `public/` no requieren este servicio.
- **Mercado Pago:** permanece expresamente desactivado (`MP_ENABLED=false`). No cargar claves de producción ni habilitar cobros en esta demo.
- **Envíos:** la integración usa servicios públicos de OpenStreetMap, sin SLA. Puede fallar por límites o inactividad.
- **Datos:** Neon almacena la base, pero los archivos locales de Render Free son efímeros. No guardar imágenes subidas ni otros datos persistentes en el disco de Render.
- **Registro de compras de prueba:** el sistema permite confirmar pedidos con medios manuales si hay stock. Evitá usar personas o datos reales durante la demostración.

## 6. Cuando quieras ventas reales

Migrar a alojamiento que permanezca encendido, correo transaccional HTTPS, backups y monitorización. Probar pagos y reembolsos, manejo de pedidos duplicados, CORS, permisos, stock, entregas y seguridad antes de abrir la tienda.

Referencias: https://render.com/docs/free · https://render.com/docs/blueprint-spec · https://neon.com/pricing · https://cloudinary.com/pricing
