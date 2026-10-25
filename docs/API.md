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
| `GET`, `POST /administracion/categorias/` | Listar o crear categorías |
| `PATCH`, `DELETE /administracion/categorias/<id>/` | Renombrar o borrar una categoría |
| `GET /administracion/resumen/?dias=7\|30\|90` | Ventas, visitantes, conversión, más vendidos, medios de pago, stock bajo y últimos pedidos |
| `POST /administracion/ventas-mostrador/` | Registrar una venta del local: descuenta stock y queda aprobada |
| `GET /administracion/clientes/?q=` | Cuentas de clientes con compras y monto aprobado (solo lectura) |
| `GET`, `PATCH /administracion/solicitudes/` | Consultas de atención; solo se cambia el `estado` |
| `GET`, `PATCH /administracion/juego/` | Probabilidades y vigencia del juego de cartas, y últimos 50 premios |
| `GET`, `PATCH /administracion/tienda/` | Datos de transferencia, tarifas de envío por km y textos de los emails |

Para subir imágenes, el cuerpo va como `multipart/form-data` con los datos en el campo `datos` (JSON), la imagen principal en `imagen_archivo` y la de cada sabor en `sabor_imagen_<índice>`. Pedidos, pagos manuales y solicitudes de atención se gestionan desde `/administracion`; Django Admin queda para los registros de base.

La gestión de pedidos recibe `accion` y `actualizado` (la fecha devuelta al consultar el pedido). Rechaza con 409 una versión desactualizada o una transición no disponible. Acciones: `aprobar`, `cancelar`, `completar_stock`, `consultar_pago`, `cerrar_sin_pago`, `cerrar_reembolsado` y `anular_mostrador` (anula una venta de mostrador y devuelve el stock); consultar `acciones` en cada pedido. Los cierres de revisión requieren además `verificado_proveedor: true`: registran una comprobación manual, no ejecutan devoluciones de dinero. Se bloquean las filas durante el cambio y se guarda un registro administrativo. Los correos de pago confirmado se envían después del commit. Los pedidos no se eliminan ni permiten editar precios o cantidades. Respuestas administrativas con `Cache-Control: no-store`.

El checkout manual devuelve `nombre_pedido`, `nombre_comprador` e `items` con nombres, sabores, cantidades y precios guardados al comprar. Los reintentos conservan esos datos aunque cambie el catálogo. WhatsApp muestra el detalle de productos y deja el ID como referencia secundaria; la consulta del retorno de pago también devuelve `nombre_pedido`.

Los combos se crean y editan con una imagen subida por el owner (JPG, PNG o WebP de hasta 5 MB), o una imagen existente de Cloudinary/ruta local. Los productos incluidos definen el contenido y el stock del combo; se admiten de uno a treinta productos diferentes. No hay generación automática de imágenes.

Las solicitudes de tipo `consulta` notifican a `ATENCION_EMAIL`, con el email del cliente en `Reply-To`. Si SMTP falla, la consulta permanece guardada y se registra una advertencia; no hay reintento automático del correo. El límite de atención por IP incluye también sesiones autenticadas.

Al abrir `/confirmar-email#token=…`, el frontend confirma automáticamente, guarda la sesión y retira el token de la dirección. La API devuelve `detail`, `token` y `usuario`, con `Cache-Control: no-store`. El enlace sigue venciendo a las 24 horas y se consume una sola vez; enlaces vencidos, repetidos o de cuentas administrativas no entregan una sesión.

La venta de mostrador recibe `venta_key` (UUID, evita registrar dos veces la misma venta), `items` (como en el checkout), `medio_pago` (`local` o `transferencia`) y, opcionalmente, `nombre_comprador` y `telefono_comprador`. Usa los mismos bloqueos de stock que el checkout.

## Juego y analítica

- `GET /juego`: estado del juego y si el usuario con sesión puede jugar. `POST /juego/jugar`: sortea el premio en el servidor (5 %, 10 % o envío gratis) y bloquea la fila del usuario para que un doble clic no gaste dos jugadas. El checkout lo aplica con `usar_premio: true`.
- `POST /analitica/visita`: cuenta vistas por día y ruta y visitantes únicos con una huella diaria que no guarda la IP. Ignora bots y `/administracion`.

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
- `GET /administracion/categorias/` y `POST /administracion/categorias/`: requieren superusuario activo. Crear con `{"nombre":"Aminoácidos"}`; el servidor genera `aminoacidos`, rechaza duplicados equivalentes y reserva `todos` y `combos`. El slug es estable: renombrar cambia solo el nombre visible. Solo se borra una categoría sin productos que no use la portada (409 si no).
- Al guardar un producto, `categoria` debe ser un slug registrado. La migración 0013 conserva las categorías existentes.
- Si la API se publica detrás de un proxy en `/api`, anteponer ese prefijo a todos los endpoints.
