# Ragnar Suplementos

Tienda online de suplementos con un frontend en Next.js y una API en Django REST Framework. El sitio permite explorar productos y combos, armar un carrito, calcular envíos en Formosa y generar pedidos con pago por Mercado Pago o medios manuales. Django es la fuente de verdad para catálogo, precios, stock y estado de cada pedido.

## Qué incluye

- Catálogo de productos por categoría, detalle de productos con variantes de sabor y combos con precio propio.
- Carrito persistido en el navegador, con cantidades limitadas por el stock informado por la API.
- Checkout como invitado o con una cuenta opcional. La compra no requiere registrarse.
- Pago online con Mercado Pago cuando está habilitado; transferencia a Personal Pay o pago al retirar/recibir, sujetos a la configuración.
- Reservas de inventario al crear un pedido, expiración automática y revisión administrativa de casos de pago o stock.
- Cotización de envío en auto desde Formosa mediante geocodificación y rutas de OpenStreetMap/FOSS GIS.
- Panel Django para administrar productos, combos, inventario, pedidos y solicitudes de atención.
- Formularios públicos de reclamo, consulta y arrepentimiento de compra.

## Tecnologías

| Parte | Tecnologías |
| --- | --- |
| Interfaz | Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4 |
| Estado del navegador | Zustand; carrito y sesión se guardan en `localStorage` |
| API y administración | Django 6, Django REST Framework, Simple JWT |
| Base de datos | SQLite para desarrollo si no se define `DATABASE_URL`; PostgreSQL para producción |
| Integraciones opcionales | Mercado Pago, Cloudinary, SMTP, OpenStreetMap/FOSS GIS |
| Despliegue incluido | Render Blueprint (`render.yaml`) |

## Requisitos

- Node.js 20.9 o posterior y npm.
- Python 3.12 o posterior.
- PostgreSQL si querés desarrollar con una base similar a producción. En local Django usa SQLite automáticamente si no configurás `DATABASE_URL`.

## Puesta en marcha local

Desde la raíz del repositorio, prepará las variables del backend:

```bash
cp .env.example .env
```

Editá `.env` y definí al menos una clave local para Django. Para usar PostgreSQL, configurá `DATABASE_URL`; si no lo hacés, Django crea/usa `backend/db.sqlite3`.

### Backend Django

En una terminal:

```bash
python -m venv backend/.venv
source backend/.venv/bin/activate
python -m pip install -r requirements.txt
python backend/manage.py migrate
python backend/manage.py ensure_catalogo
python backend/manage.py createsuperuser
python backend/manage.py runserver
```

La API queda en `http://127.0.0.1:8000` y el panel en `http://127.0.0.1:8000/admin/`. El comando `ensure_catalogo` carga los datos iniciales únicamente si todavía no hay productos. El catálogo inicial arranca con stock cero: iniciá sesión en el panel y cargá cantidades reales antes de aceptar pedidos.

### Frontend Next.js

En otra terminal, desde la raíz:

```bash
npm ci
cp .env.local.example .env.local
npm run dev
```

El sitio queda en `http://localhost:3000`. `NEXT_PUBLIC_API_URL` indica dónde está la API y, con el archivo de ejemplo, apunta a `http://127.0.0.1:8000`.

Comandos disponibles:

```bash
npm run dev     # servidor de desarrollo
npm run build   # compilación de producción
npm start       # servidor Next.js compilado
npm run lint    # ESLint
```

Para regenerar el catálogo de desarrollo, `python backend/manage.py seed_catalogo` actualiza los datos iniciales de productos y combos, pero conserva el stock existente de los productos. `ensure_catalogo` es el comando seguro para inicializar una base vacía.

## Páginas de la tienda

| Ruta | Contenido |
| --- | --- |
| `/` | Inicio, destacados y aviso del resultado de un pago al regresar de Mercado Pago |
| `/productos` | Catálogo y filtro por categoría (`?categoria=...`); también permite ver combos |
| `/productos/<slug>` | Detalle, sabores, stock y acción para agregar el producto al carrito |
| `/combos` | Catálogo de combos |
| `/combos/<slug>` | Detalle del combo, productos incluidos, ahorro y stock calculado |
| `/login` | Registro e inicio de sesión opcionales |
| `/atencion` | Solicitudes de arrepentimiento, reclamos y consultas; admite `?tipo=reclamo` o `?tipo=consulta` |
| `/privacidad` | Política de privacidad publicada en el sitio |

## API principal

Las rutas pertenecen al backend Django. Salvo que se indique lo contrario, responden JSON.

| Método y ruta | Uso |
| --- | --- |
| `GET /health/` | Estado de la API y conexión a la base |
| `GET /productos/` | Productos activos; admite `?categoria=<slug>` |
| `GET /productos/<slug>/` | Detalle de un producto activo |
| `GET /combos/` | Combos activos con sus componentes y stock calculado |
| `GET /combos/<slug>/` | Detalle de un combo activo |
| `POST /auth/registro` | Crear cuenta y devolver token JWT |
| `POST /auth/login` | Iniciar sesión y devolver token JWT |
| `GET /auth/perfil` | Perfil; requiere `Authorization: Bearer <token>` |
| `GET /pagos/metodos` | Medios de pago y disponibilidad actual |
| `POST /envios/cotizar` | Calcular distancia y costo de envío para una dirección |
| `POST /pagos/crear-preferencia` | Crear pedido y checkout; también registra pedidos manuales |
| `GET /pagos/verificar-retorno` | Consultar y procesar el estado del pago al regresar del proveedor |
| `POST /pagos/webhook` | Recibir notificaciones firmadas de Mercado Pago |
| `POST /atencion/solicitudes` | Guardar una solicitud de atención |
| `/admin/` | Administración Django; requiere una cuenta de staff |

El código de integración del frontend y los tipos de las respuestas están en [`lib/api.ts`](lib/api.ts). Las URLs de Django se conectan con sus vistas en [`backend/config/urls.py`](backend/config/urls.py).

## Cómo funciona una compra

1. El frontend obtiene productos, combos, precios y stock de la API. El carrito guarda identificadores, sabor y cantidades en el navegador; no guarda el precio como fuente confiable.
2. Para envío, el backend geocodifica origen y destino y calcula una ruta en auto. La cotización se firma y vence a los 15 minutos; checkout verifica que siga vigente y corresponda a la dirección y al origen configurados.
3. Al confirmar, Django vuelve a consultar los artículos, recalcula el total y bloquea las filas de inventario dentro de una transacción. Un combo reserva una unidad de cada producto que lo compone. No se confía en importes enviados por el navegador.
4. El stock se reserva al crear el pedido hasta `PEDIDO_RESERVA_MINUTOS` (1440 por defecto). Si se cancela o vence una reserva pendiente, las unidades vuelven al inventario.
5. En Mercado Pago, el usuario completa el pago fuera del sitio. La API verifica la notificación consultando al proveedor y valida moneda e importe antes de aprobar el pedido. Una demora, discrepancia o falta de stock puede dejar el pedido en revisión.
6. Transferencias y pagos en el local son manuales: el pedido queda pendiente y el stock reservado hasta que una persona lo apruebe o cancele desde el admin. El comprador recibe las instrucciones y puede coordinar por WhatsApp.

Los pedidos pueden quedar en estados como `pendiente`, `aprobado`, `rechazado`, `cancelado`, `revisar_stock`, `revision_pago`, `reembolsado` o `contracargo`. En el admin hay acciones para confirmar o cancelar pagos manuales, completar pedidos pagados que esperan reposición y reconciliar/cerrar revisiones de Mercado Pago. Verificá el pago en Mercado Pago antes de cerrar manualmente una revisión.

### Envíos

El origen predeterminado es `Azcuénaga 991, Formosa, Formosa, Argentina`. Los límites y precios se configuran en `ENVIO_TARIFAS_KM_ARS`, con formato `kilómetros:pesos` separado por comas; el valor predeterminado es `1:0,3:1000,5:2500,8:3500,12:5000`. Las distancias mayores al último tramo no se cotizan automáticamente.

La aplicación consulta Nominatim y el servicio público de rutas OSRM de OpenStreetMap; aplica una pausa entre consultas y conserva resultados en la caché local de Django. Son servicios públicos sin SLA, por lo que una consulta puede fallar o necesitar reintento. `OSM_CONTACT_EMAIL` permite agregar un contacto al identificador HTTP de la aplicación.

## Variables de entorno

Las plantillas son [`.env.example`](.env.example) para Django y [`.env.local.example`](.env.local.example) para Next.js. No guardes credenciales reales en el repositorio.

### Django (`.env`)

| Variable | Función |
| --- | --- |
| `DJANGO_SECRET_KEY` | Clave de Django; usá una clave aleatoria larga fuera de desarrollo |
| `DJANGO_DEBUG` | Modo de depuración. Debe ser `false` en producción |
| `DJANGO_ALLOWED_HOSTS` | Hosts permitidos, separados por comas |
| `DJANGO_CSRF_TRUSTED_ORIGINS` | Orígenes confiables para CSRF, separados por comas |
| `DATABASE_URL` | Conexión a PostgreSQL; si falta, se usa SQLite local |
| `FRONTEND_URL` | Orígenes permitidos por CORS; también se usa para retornos de pago y enlaces de correo |
| `CORS_ALLOWED_ORIGIN_REGEXES` | Patrones CORS adicionales; requerido en producción |
| `PEDIDO_RESERVA_MINUTOS` | Duración de una reserva de stock; predeterminado: 1440 |
| `MP_ENABLED`, `MP_ACCESS_TOKEN` | Habilitación y credencial de Mercado Pago |
| `MP_WEBHOOK_URL`, `MP_WEBHOOK_SECRET` | URL pública HTTPS y firma de notificaciones de Mercado Pago |
| `PAGO_ALIAS`, `PAGO_CVU`, `PAGO_TITULAR` | Datos de transferencia a Personal Pay; se requiere alias o CVU para habilitarla |
| `LOCAL_INSTRUCCIONES` | Instrucciones de coordinación para pedidos con pago manual |
| `ENVIO_ORIGEN`, `ENVIO_TARIFAS_KM_ARS`, `OSM_CONTACT_EMAIL` | Origen, franjas de precio y contacto para cotización de envíos |
| `EMAIL_BACKEND`, `EMAIL_HOST`, `EMAIL_PORT`, `EMAIL_USE_TLS` | Transporte SMTP. En desarrollo, por defecto los correos se imprimen en la terminal |
| `EMAIL_HOST_USER`, `EMAIL_HOST_PASSWORD`, `DEFAULT_FROM_EMAIL` | Credenciales y remitente del correo |
| `CLOUDINARY_URL` | Conexión de Cloudinary para subir imágenes desde el admin |

En producción, además de la clave y base persistente, Django exige hosts y orígenes HTTPS configurados. Si se activa Mercado Pago, también exige token, URL de webhook HTTPS y secreto de firma.

### Next.js (`.env.local`)

| Variable | Función |
| --- | --- |
| `NEXT_PUBLIC_API_URL` | URL base de la API Django; predeterminada en el cliente: `http://127.0.0.1:8000` |

El cliente de Supabase en `lib/supabase.ts` no está importado por el flujo actual de la tienda y no se necesita para iniciar o compilar el sitio.

## Estructura del repositorio

```text
app/                         Rutas, páginas y estilos globales de Next.js
components/                  Navegación, catálogo, carrito, checkout y formularios
data/                        Catálogo estático auxiliar/legacy; no es la fuente de datos de la tienda
lib/api.ts                   Tipos y funciones cliente para la API Django
lib/supabase.ts              Cliente Supabase aislado, actualmente sin uso en las páginas
store/                       Estado persistido de carrito y sesión (Zustand)
types/                       Tipos compartidos del frontend
public/                      Logos, slides e imágenes locales de productos
backend/config/              Configuración, URLs y entradas WSGI/ASGI de Django
backend/store/               Modelos, vistas, pedidos, envíos, correos, admin y migraciones
backend/store/management/    Comandos para catálogo y expiración de reservas
scripts/render-build.mjs     Configura la URL interna de Django durante la compilación en Render
render.yaml                  Servicios Render: frontend, API, PostgreSQL y cron de reservas
```

### Modelos de datos

- `Producto`: identidad y descripción del producto, categoría, precio, sabores, imagen, stock y publicación.
- `Combo`: precio propio y relación con productos. Su stock disponible se calcula como el menor stock entre sus componentes activos.
- `Pedido`: comprador, total, entrega, medio de pago, identificadores del proveedor, reserva e historial de estados.
- `ItemPedido`: copia el nombre, sabor, cantidad y precio unitario del momento de la compra; guarda los componentes del combo para poder liberar/descontar inventario aunque el combo cambie después.
- `SolicitudAtencion`: reclamos, consultas y solicitudes de arrepentimiento recibidas desde el sitio.

Las migraciones que definen la evolución del esquema están en `backend/store/migrations/`.

## Despliegue en Render

`render.yaml` declara cuatro recursos: API Django, sitio Next.js, base PostgreSQL y un cron que ejecuta `expirar_reservas` cada 15 minutos. Para usarlo, conectá el repositorio en Render y creá un Blueprint con ese archivo.

El despliegue aplica migraciones y ejecuta `ensure_catalogo` antes de iniciar la API. El build del frontend toma `DJANGO_API_HOST` y lo convierte en `NEXT_PUBLIC_API_URL`. El Blueprint define las versiones de Node y Python utilizadas por sus servicios.

Después del primer despliegue:

1. Configurá las variables secretas desde el panel de Render; el Blueprint deja los datos de transferencia sin sincronizar para que los completes.
2. Creá una cuenta administrativa ejecutando `python backend/manage.py createsuperuser` en la consola del servicio API.
3. Entrá a `/admin/`, revisá el catálogo inicial y cargá el stock real antes de habilitar ventas.
4. Configurá Mercado Pago, SMTP y Cloudinary solo si vas a utilizar esas integraciones. Para Mercado Pago, habilitá `MP_ENABLED` únicamente después de definir credenciales y webhook público.
5. Confirmá `FRONTEND_URL`, CORS y el dominio de API para que coincidan con los dominios públicos de Render.

No habilites pedidos con inventario sin cargar ni validar el stock real: el catálogo inicial se crea intencionalmente con stock cero.

## Operación del backend

```bash
python backend/manage.py migrate
python backend/manage.py ensure_catalogo
python backend/manage.py createsuperuser
python backend/manage.py expirar_reservas
```

`expirar_reservas` cancela pedidos pendientes vencidos y libera sus unidades reservadas. Render lo ejecuta automáticamente con el cron definido en `render.yaml`; en otro hosting se debe programar una tarea equivalente.
