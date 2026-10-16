# API

Las rutas están en [`backend/config/urls.py`](../backend/config/urls.py) y el cliente del frontend en [`lib/api.ts`](../lib/api.ts). Las de catálogo y administración terminan en `/`; las de cuenta, pagos, envíos y atención no.

## Tienda

| Método y ruta | Uso |
| --- | --- |
| `GET /health/` | Estado de la API y de la base |
| `GET /productos/` | Productos publicados; admite `?categoria=<slug>` |
| `GET /productos/<slug>/` | Detalle de un producto |
| `GET /combos/` | Combos publicados, con sus productos y el stock calculado |
| `GET /combos/<slug>/` | Detalle de un combo |
| `GET /pagos/metodos` | Medios de pago habilitados |
| `POST /envios/cotizar` | Distancia y costo de envío para una dirección de Formosa |
| `POST /pagos/crear-preferencia` | Crear el pedido; con Mercado Pago devuelve el link de pago |
| `GET /pagos/verificar-retorno` | Consultar el pago al volver de Mercado Pago |
| `POST /pagos/webhook` | Notificaciones firmadas de Mercado Pago |
| `POST /atencion/solicitudes` | Arrepentimiento, reclamo o consulta |

## Cuenta

| Método y ruta | Uso |
| --- | --- |
| `POST /auth/registro` | Crear una cuenta pendiente y mandar el mail de confirmación. No devuelve token |
| `POST /auth/email/confirmar` | Activar la cuenta con el `token` del mail |
| `POST /auth/email/reenviar` | Pedir otro mail de confirmación |
| `POST /auth/login` | Iniciar sesión con usuario o email; devuelve un JWT |
| `GET /auth/perfil` | Datos de la cuenta; requiere `Authorization: Bearer <token>` |
| `POST /auth/contrasena/recuperar` | Pedir el mail de recuperación |
| `POST /auth/contrasena/restablecer` | Cambiar la contraseña con `uid`, `token`, `password` y `password_confirmacion` |

## Administración

Requieren el JWT de un superusuario activo.

| Método y ruta | Uso |
| --- | --- |
| `GET`, `POST /administracion/productos/` | Listar todos los productos o crear uno |
| `GET`, `PATCH`, `DELETE /administracion/productos/<id>/` | Ver, editar o borrar un producto |
| `GET`, `POST /administracion/combos/` | Listar todos los combos o crear uno |
| `GET`, `PATCH`, `DELETE /administracion/combos/<id>/` | Ver, editar o borrar un combo |

Para subir imágenes, el cuerpo va como `multipart/form-data` con los datos en el campo `datos` (JSON), la imagen principal en `imagen_archivo` y la de cada sabor en `sabor_imagen_<índice>`. Pedidos, pagos manuales y solicitudes de atención se manejan desde Django Admin en `/admin/`.

## Errores

Los errores traen `detail` o una clave por campo.

| Código | Cuándo |
| --- | --- |
| `400` | Datos inválidos o un link de confirmación o recuperación que ya no sirve |
| `401` | Sin sesión o con un JWT que ya no vale |
| `403` | Sin permiso, o una cuenta que todavía no confirmó su email |
| `404` | El producto o combo no existe o no está publicado |
| `409` | La misma `checkout_key` con otro carrito, un pedido ya registrado, un stock que cambió desde que se abrió el editor o borrar un artículo que ya tiene pedidos |
| `429` | Demasiados intentos |
| `503` | La base no responde en `/health/`, o el medio de pago elegido no está configurado |
