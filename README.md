# Ragnar Suplementos

**E-commerce Full Stack para una tienda de suplementación deportiva en Formosa, Argentina.**

Ragnar combina una experiencia de compra responsive con un catálogo administrable, control de stock compartido, cálculo de envíos y distintas formas de pago. La interfaz **Ragnar Forge** prioriza una navegación clara desde el descubrimiento del producto hasta la confirmación del pedido.

## Funcionalidades

**Tienda**
- Catálogo de productos por categoría, variantes de sabor con imágenes y combos.
- Tarjetas de producto, búsqueda y filtros; detalle de producto con selección de sabor y cantidad.
- Carrito persistente con Zustand, vista rápida lateral y checkout en la página `/carrito`.
- Compra como invitado o con cuenta: registro, confirmación de email y recuperación de contraseña.
- Retiro en el local o entrega dentro de Formosa, con cotización de envío según distancia.
- Pago con Mercado Pago (si está configurado), transferencia o efectivo, según disponibilidad.
- Formulario de asesoramiento y solicitudes de consulta, reclamo o arrepentimiento.

**Administración**
- Panel en `/administracion` para publicar y editar productos, combos, precios, stock y fotografías.
- Gestión de pedidos y pagos manuales desde Django Admin.
- Validación del inventario y del importe del pedido en el servidor.

## Tecnologías

| Capa | Tecnologías |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Estado | Zustand con persistencia local del carrito |
| Backend | Python, Django 6, Django REST Framework, Simple JWT |
| Datos | PostgreSQL en producción; SQLite para desarrollo |
| Integraciones | Mercado Pago, Cloudinary, SMTP, OpenStreetMap (Nominatim y OSRM) |

## Arquitectura y decisiones técnicas

- **El backend es la fuente de verdad.** El frontend no fija precios finales ni stock: Django vuelve a validar artículos, disponibilidad y totales durante el checkout.
- **Stock compartido entre productos y combos.** Cada combo consume el inventario de sus componentes, evitando vender dos veces la misma unidad.
- **Checkout idempotente.** Una clave de intento de compra ayuda a evitar pedidos duplicados ante reintentos o doble clic.
- **Reservas y conciliación de pagos.** Los pedidos reservan unidades durante un plazo configurable. Las notificaciones de Mercado Pago se validan en el servidor y los casos inconsistentes requieren revisión.
- **Separación de responsabilidades.** Next.js presenta la experiencia de compra; Django expone las APIs y administra las reglas de negocio.

## Estructura

```text
app/                 Páginas Next.js: inicio, catálogo, combos, carrito, cuenta
components/          Interfaz, navegación, formularios y componentes de compra
store/               Estado de autenticación y carrito
lib/                 Cliente HTTP de la API Django
types/               Tipos TypeScript
public/              Identidad visual e imágenes de productos
backend/             API REST, modelos, pedidos, pagos, envíos y administración
docs/                Referencia de API e instrucciones de despliegue
```

## Ejecutar localmente

Requisitos: **Node.js 20.9 o superior** y **Python 3.12 o superior**.

**1. Backend**

Desde la raíz del repositorio:

```bash
cp .env.example .env
python -m venv backend/.venv
```

Activá el entorno virtual con `source backend/.venv/bin/activate` en Bash/Zsh o con `source backend/.venv/bin/activate.fish` en Fish.

```bash
pip install -r requirements.txt
python backend/manage.py migrate
python backend/manage.py ensure_catalogo
python backend/manage.py createsuperuser
python backend/manage.py runserver
```

Sin `DATABASE_URL`, Django usa SQLite. `ensure_catalogo` puede preparar artículos con stock cero; las cantidades reales se configuran desde administración.

**2. Frontend**

En otra terminal, también desde la raíz:

```bash
npm ci
cp .env.local.example .env.local
npm run dev
```

Abrí **http://localhost:3000**. La API utiliza por defecto **http://127.0.0.1:8000**.

> Podés visualizar el diseño del frontend sin iniciar Django, pero el catálogo dinámico, el carrito con precios actualizados, el formulario y el checkout necesitan la API activa.

## Verificaciones

```bash
npm run lint
npx tsc --noEmit
npm run build
python backend/manage.py test
```

El último comando necesita las dependencias de Python instaladas y el entorno configurado. Los flujos de pago y envío requieren además pruebas de integración con sus servicios correspondientes.

## Documentación

- [Endpoints de la API](docs/API.md)
- [Variables de entorno y despliegue](docs/DESPLIEGUE.md)
- [Deploy gratuito de prueba: Render + Neon](docs/DESPLIEGUE-GRATIS.md)
- [Configuración de infraestructura](render.yaml)

## Uso del código

Repositorio público para mostrar la implementación y su arquitectura. No se incluye una licencia de reutilización; la marca, los logos y las imágenes de productos pertenecen a sus respectivos titulares.
