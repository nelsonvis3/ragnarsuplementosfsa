# Ragnar Suplementos

**A full-stack e-commerce application built for a sports nutrition business in Formosa, Argentina.**

Ragnar Suplementos connects a responsive storefront to an administrative system for products, bundles, stock, orders, and customer accounts. The central challenge was giving the business owner control over the catalog while keeping prices and inventory consistent throughout checkout.

**[Portfolio case study](https://nelsonsivisstum.vercel.app/en/projects/ragnar-suplementos/)** · **[API reference](docs/API.md)** · **[Deployment guide](docs/VPS-DOCKER.md)**

> **Project status:** The application and its administrative workflows have been developed and tested in isolated environments. A production VPS deployment, public domain, and payment-provider acceptance tests are **not yet complete**. Do not treat this repository as an operating public store.

## Screenshots

| Product details | Shopping cart | Administration |
| --- | --- | --- |
| ![Ragnar product page](docs/capturas/producto.jpg) | ![Cart and checkout](docs/capturas/carrito.jpg) | ![Catalog and order administration](docs/capturas/administracion.jpg) |

## What problem does it solve?

The business needed to update its own inventory, prices, photos, and bundles without asking a developer for every change. A conventional storefront was not enough: the same product could also appear inside a bundle, so independently tracked quantities could lead to overselling. Ragnar keeps those rules on the Django backend instead of trusting values from the browser.

## Features

**Customers**
- Browse products by category, search and filter the catalog, and choose flavor variants.
- View bundles composed of products sharing the same inventory.
- Use a persistent shopping cart and a dedicated checkout page.
- Register, confirm an email address, sign in, and recover a password.
- Request local delivery quotes or choose store pickup.
- Choose available manual payment methods; Mercado Pago integration is configurable but requires provider credentials and end-to-end acceptance before real transactions.
- Send a customer-service request or request product advice.

**Store owner**
- Manage categories, products, variants, bundles, images, pricing, and stock through `/administracion`.
- Search and filter orders, inspect their recorded items, and perform permitted order-state transitions.
- Review manually confirmed payments and cancel eligible orders with inventory restoration.
- Access Django Admin for the underlying records and customer-service requests.

## Technology

| Layer | Technologies |
| --- | --- |
| Frontend | Next.js 16, React 19, TypeScript, Tailwind CSS 4 |
| Client state | Zustand (persistent cart) |
| Backend | Python, Django 6, Django REST Framework, Simple JWT |
| Database | PostgreSQL for the prepared production configuration; SQLite for local development |
| Infrastructure | Docker Compose, Nginx, Gunicorn, Redis |
| Integrations | Mercado Pago (optional), Cloudinary, email via SMTP or Resend, OpenStreetMap routing/geocoding |

## Engineering decisions

**The server owns prices and stock.** Django recalculates order totals from database records, validates availability, and rejects inconsistent checkout requests. The frontend cannot dictate final amounts.

**Products and bundles share inventory.** A bundle consumes stock from its constituent products. Locks and an ordered locking strategy help prevent concurrent purchases from reserving the same last unit.

**Checkout is designed for retries.** A checkout key detects duplicate attempts, while the order preserves purchased item names, prices, and quantities even if the catalog changes later.

**Administrative actions follow the order lifecycle.** Order-management requests validate permissions, state transitions, and record versions; sensitive operations are written transactionally.

See [the API reference](docs/API.md) for routes, authentication, errors, and administrative actions, and the [October 21 audit](docs/AUDITORIA-2026-10-21.md) for specific fixes and validation limits.

## Run locally

**Requirements:** Node.js 20.9+ and Python 3.12+. No production payment or email credentials are needed to inspect the application locally.

Clone the repository and create the backend configuration:

```bash
git clone https://github.com/nelsonvis3/ragnarsuplementosfsa.git
cd ragnarsuplementosfsa
cp .env.example .env
python -m venv backend/.venv
```

Activate the virtual environment with `source backend/.venv/bin/activate` (Bash/Zsh) or `source backend/.venv/bin/activate.fish` (Fish). Start Django from the repository root:

```bash
python -m pip install -r requirements.txt
python backend/manage.py migrate
python backend/manage.py ensure_catalogo
python backend/manage.py createsuperuser
python backend/manage.py runserver
```

In another terminal, still in the repository root, start Next.js:

```bash
npm ci
cp .env.local.example .env.local
npm run dev
```

Open **http://localhost:3000**; the default API runs at **http://127.0.0.1:8000**. Without `DATABASE_URL`, Django uses local SQLite. The initial catalog may contain items with **zero stock**; use the administrative interface to enter real quantities before trying checkout.

> In local development, emails normally appear in the backend terminal. External payments, image uploads, and delivery quotes require their respective services and configuration. Never commit real `.env` files or provider credentials.

## Tests and validation

```bash
npm run lint
npx tsc --noEmit
npm run build
python backend/manage.py test
```

The [October 21 audit](docs/AUDITORIA-2026-10-21.md) records a PostgreSQL suite with 76 passing tests at an earlier stage, followed by a SQLite run discovering 94 tests (92 passed, 2 skipped because they require PostgreSQL row locking). These are **historical local results**, not a claim about a fresh CI run or a live production installation. Payment providers and public hosting still need acceptance testing.

## Deployment and current limitations

A [VPS plan using Docker Compose, Nginx, HTTPS, PostgreSQL, and Redis](docs/VPS-DOCKER.md) is prepared; a separate [Render + Neon demo alternative](docs/DESPLIEGUE-GRATIS.md) is also documented. Neither setup should be described as a verified public production deployment until its acceptance checklist is completed. In particular, real transactions require payment, email delivery, stock reconciliation, monitoring, backups, and restoration tests.

## Documentation

- [HTTP API and permissions](docs/API.md)
- [Technical audit and testing evidence](docs/AUDITORIA-2026-10-21.md)
- [VPS / Docker / Nginx deployment plan](docs/VPS-DOCKER.md)
- [Environment variables and deployment](docs/DESPLIEGUE.md)
- [Free demo hosting alternative](docs/DESPLIEGUE-GRATIS.md)

## About this project / Sobre el proyecto

This is a real client-oriented project and a portfolio case study by **Nelson Sivisstum**. Business names, logos, and product imagery belong to their respective owners.

*Ragnar Suplementos es una tienda full stack desarrollada para un negocio de suplementación de Formosa. Incluye catálogo, carrito, gestión de pedidos y un panel donde el propietario puede administrar productos, precios, imágenes y stock. El despliegue público y las pruebas con proveedores reales todavía están pendientes.*

**License:** This repository does not declare an open-source license. Its public visibility does not grant permission to reuse the code, brand, or assets.
