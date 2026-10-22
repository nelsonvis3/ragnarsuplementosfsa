# Auditoría y preparación de Ragnar — 21 de octubre de 2026

Se revisaron los flujos de catálogo, administración, cuentas, correo, carrito, pedidos, stock, pagos, envíos y configuración de despliegue. Se corrigieron los defectos encontrados y se repitieron las comprobaciones indicadas abajo. Esto no certifica ausencia absoluta de errores ni sustituye las pruebas con los proveedores y la infraestructura reales.

**No se publicó la tienda, no se hizo push ni se modificó un VPS.** Antes de hostear, Nelson debe poder hacer el push y confirmar el despliegue.

## Funciones solicitadas

- **Categorías:** registro persistente en Django, consulta pública y creación desde `/administracion`, reservada a superusuarios. La migración `0013_categorias` conserva las categorías y productos existentes. Rechaza nombres vacíos, duplicados equivalentes y nombres reservados. Los formularios de producto y filtros del catálogo usan el registro de categorías. La migración está aplicada en la base local, comprobado mediante `showmigrations store`.
- **Destacados automáticos:** `/productos/destacados/` devuelve hasta cuatro productos activos, ordenados por unidades de pedidos aprobados, de mayor a menor. Incluye los componentes guardados en las ventas de combos. Los pedidos pendientes, cancelados, reembolsados o en revisión no suman. Los empates se resuelven por ID; sin ventas se conserva ese orden estable. No se crearon ventas ficticias. Un producto agotado puede seguir destacado, indicando su disponibilidad. Los combos históricos sin snapshot de componentes no permiten reconstruir ventas individuales de forma fiable.
- **Correos personalizados:** configuración SMTP preparada para `nelsonsivisstum3@gmail.com`, puerto 465 y SSL. El registro utiliza nombre del cliente, identidad visual, logo y enlace de confirmación; la recuperación de contraseña conserva su flujo independiente. No se guardaron contraseñas en archivos versionados. Después de la auditoría, Nelson configuró `EMAIL_HOST_PASSWORD` y autorizó un único correo de prueba a su propia cuenta. El backend se autenticó y Gmail aceptó el mensaje «Ragnar — Prueba de correo» (resultado SMTP: 1). Nelson confirmó la recepción en Gmail. Después se personalizó la plantilla de registro con el logo original, nombre del cliente, marca Ragnar Suplementos y el mensaje «Hacé clic abajo para confirmar tu cuenta y desbloquear tu potencial», con 15 pruebas de registro y confirmación aprobadas. La versión personalizada todavía no se reenvió a Gmail; faltan las pruebas completas con el dominio público.
- **VPS, Docker y Nginx:** archivos de construcción, Compose, PostgreSQL persistente, Redis compartido, migración de arranque, proceso de vencimiento de reservas, proxy HTTPS, certificados y scripts de respaldo/renovación preparados. Procedimiento en [VPS-DOCKER.md](VPS-DOCKER.md).

## Defectos corregidos

| Área | Problema y corrección |
| --- | --- |
| Ejecución de tests | Ejecutar Django desde la raíz podía resolver el directorio frontend `store` y descubrir cero pruebas. `manage.py` establece el directorio del backend. |
| Checkout concurrente | La lectura de productos y combos antes del bloqueo podía utilizar precios desactualizados; bloquear combos en distinto orden podía producir interbloqueos. Se adquieren bloqueos en un orden estable antes de validar los datos. |
| Stock administrativo | Editar otro campo desde Django Admin podía sobrescribir stock modificado concurrentemente. Se actualizan solo los campos cambiados y se comprueba el stock anterior cuando se edita inventario. |
| Historial de pedidos | Se restringieron las operaciones de Django Admin que permitían borrar pedidos/productos/combos o alterar campos técnicos de pagos y reservas. |
| Entradas inválidas | Se controlan cuerpos JSON inesperados, identificadores fuera de rango, importes excesivos y valores numéricos no finitos para evitar respuestas 500 o procesamientos incorrectos. |
| Autenticación | Registro y login públicos ya no quedan bloqueados por un JWT vencido adjunto a la solicitud. |
| Correo | Se valida que el backend confirme el envío y se conserva `reply_to` en Resend. Se impide configurar SSL y STARTTLS simultáneamente. |
| Envíos | Límites de solicitudes y control compartido de llamadas al proveedor; validación de coordenadas, distancias y tarifas. Una respuesta tardía ya no reemplaza una cotización cuya dirección se editó. |
| Compra y navegación | Cantidades máximas coherentes entre interfaz y API, enlaces de categorías corregidos y estado accesible de selección de sabor. |
| Vista móvil | Se corrigió el desbordamiento horizontal de la sección de asesoramiento en la página inicial a 375 px. |
| Operación | El endpoint de salud ejecuta una consulta a la base. Se separó la dirección interna de API usada por Next.js de la dirección pública del navegador. |
| Herramientas | ESLint excluye los archivos de terceros generados en `backend/staticfiles`, además de los demás artefactos de compilación. |

## Validaciones realizadas

| Comprobación | Resultado y alcance |
| --- | --- |
| Suite Django con PostgreSQL aislado | Auditoría inicial: **76 pruebas aprobadas**, sin omisiones. Incluye concurrencia de última unidad y compras de combos en orden inverso, además de pagos simulados, ranking, permisos, categorías y correo. Esta ejecución precede las ampliaciones de correo y combos descritas abajo. |
| Suite Django con SQLite | Revisión final con gestión web de pedidos: **94 pruebas descubiertas: 92 aprobadas y 2 omitidas**, porque requieren bloqueos reales de PostgreSQL. |
| Django `check` | Sin incidencias. |
| `makemigrations --check --dry-run` | Sin cambios de modelos pendientes de migración. |
| `check --deploy` | Sin incidencias con configuración sintética de producción y HSTS habilitado; no acredita configuración de un servidor real. |
| Frontend | Compilación de producción con `npm run build -- --webpack`, TypeScript y ESLint completados correctamente. |
| Navegador | Alta, correo en buzón local, confirmación, login, pedido manual de prueba, recuperación y restricción de administración; creación de categoría, asignación de producto, filtro y carrito con datos sintéticos. Sin errores JavaScript observados en esos recorridos. |
| Adaptación de pantalla | Revisión a 375, 812 y 1440 px. Se detectó y corrigió desbordamiento de la portada a 375 px; la nueva medición igualó el ancho del documento al de la pantalla. |
| Estáticos y dependencias Python | `collectstatic` y `pip check` completados. Esto comprueba el entorno local instalado; las dependencias de la imagen deben instalarse y validarse al construirla. |
| Archivos de operación | YAML de Compose analizado y scripts de shell verificados sintácticamente. `git diff --check` sin problemas de espacios. |

Las pruebas funcionales utilizaron cuentas, productos y pedidos sintéticos en una base aislada. El correo se capturó localmente; los pagos externos se simularon. Las comprobaciones del navegador no cubren todas las combinaciones posibles de dispositivo y estado.

## Ampliaciones posteriores solicitadas

- **Asesoramiento:** las consultas se notifican a `adansiv16@gmail.com` desde el remitente SMTP configurado. `Reply-To` apunta al email del cliente. Si el envío falla, la consulta se conserva en Django Admin y se registra una advertencia. El límite por IP protege también solicitudes autenticadas. Se probaron destinatario, respuesta al cliente, errores SMTP y límites con buzón simulado; no se envió una consulta real a Adán.
- **Confirmación con sesión automática:** abrir el enlace consume el token e inicia sesión sin volver a escribir la contraseña. La API mantiene bloqueo transaccional, vencimiento, uso único y exclusión de administradores. El navegador elimina el token de la dirección después de confirmar y ofrece continuar al catálogo. Prueba en navegador: una sola solicitud de confirmación, sesión persistida y rechazo del enlace usado en otro contexto.
- **Identidad visual:** correo de bienvenida con fondo oscuro y acentos rojos de la página; favicon SVG con silueta original blanca y contorno rojo. Se retiró el favicon amarillo. Se inspeccionaron la captura móvil del correo y el ícono renderizado; el navegador sirve `/icon.svg` con su versión. La nueva plantilla aún no se reenvió a Gmail.
- **Combos:** por decisión posterior de Nelson se retiró la generación automática de imágenes y la restricción de dos o tres productos. Se conserva la creación y edición de combos con imágenes propias subidas por el owner, o imágenes existentes, y la selección de componentes necesaria para su contenido y stock. La API vuelve a admitir de uno a treinta productos diferentes.
- **Pedidos en el panel web:** pestaña Pedidos con búsqueda, filtros, paginación, productos históricos, comprador, entrega y pago. Confirmación y cancelación manual, reposición de pedidos en revisión y consulta de Mercado Pago. Las acciones validan permisos, versión y estado, bloquean el pedido y registran la operación. Los correos de confirmación esperan al commit; un fallo en el registro administrativo revierte la operación sin enviar el correo. Los cierres manuales de revisión requieren declarar que se verificó el proveedor y no realizan reembolsos por sí mismos.
- **Nombre de la compra:** WhatsApp incluye productos, cantidades, sabores, comprador y entrega; el número queda como referencia. La confirmación visual, el retorno del pago y el correo también utilizan los nombres guardados al comprar, sin depender de cambios posteriores del catálogo.
- **Prueba final en navegador:** compra manual, lectura del enlace de WhatsApp sin enviarlo, aprobación y cancelación desde el panel, comprobación del stock y carga de imagen propia en un combo de un producto. Sin errores JavaScript en el recorrido. Panel revisado en escritorio y móvil; correo en archivos locales y Cloudinary simulado, sobre base aislada.

La prueba anterior del generador quedó fuera del alcance final: esa función fue retirada. Las verificaciones de correo, sesión automática e identidad visual se mantienen. La carga externa de imágenes durante las pruebas se simula mediante Cloudinary en una API aislada; no se publican productos de prueba en la base real.

## Pendiente antes de operar públicamente

1. Configurar también en el VPS la contraseña de aplicación de Gmail fuera de Git y comprobar registro, confirmación y recuperación con recepción real. La conexión y el envío SMTP desde el entorno local ya se verificaron con un correo autorizado; la aceptación SMTP no garantiza su ubicación en la bandeja de entrada. [Instrucciones oficiales de Google](https://support.google.com/mail/answer/185833?hl=es).
2. Nelson realizará el hosting manualmente: elegir dominio, VPS, DNS y commit después de hacer el push. No se ejecutó despliegue ni push desde esta sesión.
3. Construir y ejecutar las imágenes en Docker, comprobar `docker compose config`, salud de servicios, Redis y `nginx -t`. Docker Engine y Nginx no estaban disponibles para una prueba de ejecución durante esta auditoría; la configuración está preparada, no certificada en infraestructura real.
4. Emitir y verificar certificados HTTPS, renovación y acceso público. Probar respaldo y restauración en una base separada, y conservar copias fuera del VPS.
5. Verificar las credenciales y comportamiento reales de Cloudinary, cotización de envíos y, si se habilita, Mercado Pago en su entorno de pruebas antes de vender.
6. Revisar existencias y datos comerciales reales. Las pruebas de software no confirman inventario físico, tarifas comerciales ni capacidad del VPS.

La guía de despliegue incluye los comandos y el orden de estas comprobaciones. Las claves y contraseñas deben permanecer en archivos privados del entorno, nunca en el repositorio ni en el informe.
