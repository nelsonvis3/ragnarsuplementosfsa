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
| `POST /pagos/crear-preferencia` | Crear un pedido; **exige JWT válido** y que `email_comprador` coincida con el email de la cuenta. Con Mercado Pago devuelve el link de pago |
| `GET /pagos/verificar-retorno` | Consultar el pago al volver de Mercado Pago |
| `POST /pagos/webhook` | Notificaciones firmadas de Mercado Pago |
| `POST /atencion/solicitudes` | Arrepentimiento, reclamo o consulta |

## Cuenta

| Método y ruta | Uso |
| --- | --- |
| `POST /auth/registro` | Crear una cuenta pendiente y mandar el mail de confirmación. No devuelve token |
| `POST /auth/email/confirmar` | Activar la cuenta con el `token` del mail y devolver JWT + usuario para iniciar sesión automáticamente |
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
| `GET /administracion/pedidos/` | Listar pedidos, 20 por página; filtros `estado`, `buscar` y `page` |
| `GET /administracion/pedidos/<id>/` | Detalle histórico de productos, comprador, entrega, pago y acciones disponibles |
| `POST /administracion/pedidos/<id>/gestionar/` | Ejecutar una acción permitida para el estado y medio de pago |

Para subir imágenes, el cuerpo va como `multipart/form-data` con los datos en el campo `datos` (JSON), la imagen principal en `imagen_archivo` y la de cada sabor en `sabor_imagen_<índice>`. Pedidos y pagos manuales se gestionan desde la pestaña Pedidos de `/administracion` y también en Django Admin. Las solicitudes de atención siguen en `/admin/`.

La gestión de pedidos recibe `accion` y `actualizado` (la fecha devuelta al consultar el pedido). Rechaza con 409 una versión desactualizada o una transición no disponible. Acciones: `aprobar`, `cancelar`, `completar_stock`, `consultar_pago`, `cerrar_sin_pago`, `cerrar_reembolsado`; consultar `acciones` en cada pedido. Los cierres de revisión requieren además `verificado_proveedor: true`: registran una comprobación manual, no ejecutan devoluciones de dinero. Se bloquean las filas durante el cambio y se guarda un registro administrativo. Los correos de pago confirmado se envían después del commit. Los pedidos no se eliminan ni permiten editar precios o cantidades. Respuestas administrativas con `Cache-Control: no-store`.

El checkout manual devuelve `nombre_pedido`, `nombre_comprador` e `items` con nombres, sabores, cantidades y precios guardados al comprar. Los reintentos conservan esos datos aunque cambie el catálogo. WhatsApp muestra el detalle de productos y deja el ID como referencia secundaria; la consulta del retorno de pago también devuelve `nombre_pedido`.

Los combos se crean y editan con una imagen subida por el owner (JPG, PNG o WebP de hasta 5 MB), o una imagen existente de Cloudinary/ruta local. Los productos incluidos definen el contenido y el stock del combo; se admiten de uno a treinta productos diferentes. No hay generación automática de imágenes.

Las solicitudes de tipo `consulta` notifican a `ATENCION_EMAIL` (`adansiv16@gmail.com` en la configuración preparada), con el email del cliente en `Reply-To`. Si SMTP falla, la consulta permanece guardada y se registra una advertencia; no hay reintento automático del correo. Los reclamos y arrepentimientos siguen gestionándose en Django Admin. El límite de atención por IP incluye también sesiones autenticadas.

Al abrir `/confirmar-email#token=…`, el frontend confirma automáticamente, guarda la sesión y retira el token de la dirección. La API devuelve `detail`, `token` y `usuario`, con `Cache-Control: no-store`. El enlace sigue venciendo a las 24 horas y se consume una sola vez; enlaces vencidos, repetidos o de cuentas administrativas no entregan una sesión.

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

## Categorías y destacados

- `GET /categorias/`: categorías registradas (`id`, `nombre`, `slug`), incluidas las que aún no tienen productos.
- `GET /productos/destacados/`: hasta cuatro productos activos, ordenados por unidades vendidas en pedidos `aprobado`, de mayor a menor. Suma ventas individuales y componentes guardados en la compra de combos. Empates o ausencia de ventas: ID ascendente. Reembolsos, contracargos, pendientes y cancelados no cuentan. Los agotados mantienen su posición y el aviso de falta de stock.
- `GET /administracion/categorias/` y `POST /administracion/categorias/`: requieren superusuario activo. Crear con `{"nombre":"Aminoácidos"}`; el servidor genera `aminoacidos`, rechaza duplicados equivalentes y reserva `todos` y `combos`. El slug es estable; no hay borrado ni renombrado.
- Al guardar un producto, `categoria` debe ser un slug registrado. La migración 0013 conserva las categorías existentes.
- Detrás del Nginx de este repositorio, anteponer `/api` a todos los endpoints API.
