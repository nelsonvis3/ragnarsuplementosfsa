import type { Combo, Producto } from "@/types/producto";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";
const API_INTERNA = typeof window === "undefined" ? (process.env.API_INTERNAL_URL ?? API_URL) : API_URL;

export interface Usuario {
  id: number;
  nombre_completo: string;
  email: string;
  puede_administrar_catalogo: boolean;
  puede_recuperar_contrasena: boolean;
}

export interface AuthResponse {
  token: string;
  usuario: Usuario;
}

export interface RegistroResponse {
  email: string;
  correo_enviado: boolean;
  detail: string;
}

export interface ItemCheckout {
  tipo: "producto" | "combo";
  id: number;
  cantidad: number;
  sabor?: string;
}

export interface PreferenciaPago {
  tipo: "mercado_pago";
  id: string;
  init_point: string;
  pedido_id: number;
}

export interface EstadoRetornoPago {
  pedido_id: number;
  nombre_pedido: string;
  estado: "pendiente" | "aprobado" | "revisar_stock" | "revision_pago" | "reembolsado" | "contracargo" | "rechazado" | "cancelado";
  init_point: string;
}

export interface MedioPago {
  id: "mercado_pago" | "transferencia" | "local";
  nombre: string;
  disponible: boolean;
  detalle?: string;
  alias?: string;
  cvu?: string;
  titular?: string;
}

export interface PedidoManual {
  tipo: "manual";
  pedido_id: number;
  nombre_pedido: string;
  nombre_comprador: string;
  items: ArticuloPedido[];
  stock_reservado_hasta: string | null;
  medio_pago: "transferencia" | "local";
  total: number;
  costo_envio: number;
  distancia_envio_km: number | null;
  forma_entrega: "retiro" | "envio";
  direccion_entrega: string;
  datos_pago: {
    titulo: string;
    alias: string;
    cvu: string;
    titular: string;
    mensaje: string;
  };
  email_enviado: boolean;
}

export interface ArticuloPedido {
  nombre: string;
  sabor: string;
  cantidad: number;
  precio_unitario: number;
}

export type AccionPedido = "aprobar" | "cancelar" | "completar_stock" | "consultar_pago" | "cerrar_sin_pago" | "cerrar_reembolsado";

export interface PedidoAdministracion {
  id: number;
  nombre_pedido: string;
  items: ArticuloPedido[];
  nombre_comprador: string;
  email_comprador: string;
  telefono_comprador: string;
  estado: EstadoRetornoPago["estado"];
  estado_nombre: string;
  proveedor_pago: MedioPago["id"];
  medio_pago_nombre: string;
  forma_entrega: "retiro" | "envio";
  entrega_nombre: string;
  direccion_entrega: string;
  total: number;
  costo_envio: number;
  stock_reservado: boolean;
  stock_reservado_hasta: string | null;
  pago_id: string | null;
  pagos_adicionales: unknown[];
  creado: string;
  actualizado: string;
  acciones: AccionPedido[];
}

export interface ListaPedidos {
  count: number;
  next: string | null;
  previous: string | null;
  results: PedidoAdministracion[];
}

export function listarPedidosAdministracion(token: string, estado: string, buscar: string, pagina: number): Promise<ListaPedidos> {
  const params = new URLSearchParams({ estado, buscar, page: String(pagina) });
  return solicitar(`/administracion/pedidos/?${params}`, { headers: { Authorization: `Bearer ${token}` }, cache: "no-store" });
}

export function gestionarPedidoAdministracion(token: string, pedido: PedidoAdministracion, accion: AccionPedido, verificadoProveedor: boolean): Promise<{ detail: string; pedido: PedidoAdministracion }> {
  return solicitar(`/administracion/pedidos/${pedido.id}/gestionar/`, {
    method: "POST", headers: { Authorization: `Bearer ${token}` },
    body: JSON.stringify({ accion, actualizado: pedido.actualizado, verificado_proveedor: verificadoProveedor }),
  });
}

export interface CotizacionEnvio {
  direccion: string;
  distancia_km: number;
  costo_envio: number;
  cotizacion_envio: string;
  vigencia_minutos: number;
}

export type ResultadoCheckout = PreferenciaPago | PedidoManual;

export class ApiError extends Error {
  constructor(
    public mensaje: string,
    public status?: number
  ) {
    super(mensaje);
    this.name = "ApiError";
  }
}

function mensajeError(valor: unknown): string {
  if (typeof valor === "string") return valor;
  if (Array.isArray(valor)) return valor.map(mensajeError).filter(Boolean).join(" ");
  if (valor && typeof valor === "object") {
    const datos = valor as Record<string, unknown>;
    if ("detail" in datos) return mensajeError(datos.detail);
    return Object.entries(datos)
      .map(([campo, mensaje]) => `${campo}: ${mensajeError(mensaje)}`)
      .filter((texto) => !texto.endsWith(": "))
      .join(". ");
  }
  return "Ocurrió un error inesperado.";
}

async function solicitar<T>(ruta: string, opciones: RequestInit = {}): Promise<T> {
  let respuesta: Response;
  const headers = new Headers(opciones.headers);
  if (typeof window === "undefined" && process.env.API_INTERNAL_URL) {
    headers.set("X-Forwarded-Proto", "https");
  }
  if (opciones.body && !(opciones.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  try {
    respuesta = await fetch(`${API_INTERNA}${ruta}`, {
      ...opciones,
      signal: opciones.signal ?? AbortSignal.timeout(45000),
      cache: "no-store",
      headers,
    });
  } catch {
    throw new ApiError("No pudimos conectar con la tienda. Intentá nuevamente en unos instantes.");
  }

  const data: unknown = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    throw new ApiError(mensajeError(data), respuesta.status);
  }
  return data as T;
}

export async function listarProductos(): Promise<Producto[]> {
  return solicitar<Producto[]>("/productos/");
}

export interface Categoria { id: number; nombre: string; slug: string }

export async function listarCategorias(): Promise<Categoria[]> {
  return solicitar<Categoria[]>("/categorias/");
}

export async function listarDestacados(): Promise<Producto[]> {
  return solicitar<Producto[]>("/productos/destacados/");
}

export async function crearCategoria(token: string, nombre: string): Promise<Categoria> {
  return solicitar<Categoria>("/administracion/categorias/", {
    method: "POST", headers: { Authorization: `Bearer ${token}` }, body: JSON.stringify({ nombre }),
  });
}

export async function obtenerProductoPorSlug(slug: string): Promise<Producto | null> {
  try {
    return await solicitar<Producto>(`/productos/${encodeURIComponent(slug)}/`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function listarCombos(): Promise<Combo[]> {
  return solicitar<Combo[]>("/combos/");
}

export async function listarMediosPago(): Promise<MedioPago[]> {
  return solicitar<MedioPago[]>("/pagos/metodos");
}

export async function cotizarEnvio(direccion: string): Promise<CotizacionEnvio> {
  return solicitar<CotizacionEnvio>("/envios/cotizar", {
    method: "POST",
    body: JSON.stringify({ direccion }),
  });
}

export async function obtenerComboPorSlug(slug: string): Promise<Combo | null> {
  try {
    return await solicitar<Combo>(`/combos/${encodeURIComponent(slug)}/`);
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return null;
    throw error;
  }
}

export async function registrarUsuario(
  nombreCompleto: string,
  email: string,
  password: string
): Promise<RegistroResponse> {
  return solicitar<RegistroResponse>("/auth/registro", {
    method: "POST",
    body: JSON.stringify({ nombre_completo: nombreCompleto, email, password }),
  });
}

export async function confirmarEmail(token: string): Promise<AuthResponse & { detail: string }> {
  return solicitar("/auth/email/confirmar", { method: "POST", body: JSON.stringify({ token }) });
}

export async function reenviarConfirmacionEmail(email: string): Promise<{ detail: string }> {
  return solicitar("/auth/email/reenviar", { method: "POST", body: JSON.stringify({ email }) });
}

export async function iniciarSesion(email: string, password: string): Promise<AuthResponse> {
  return solicitar<AuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function obtenerPerfil(token: string): Promise<Usuario> {
  return solicitar<Usuario>("/auth/perfil", {
    headers: { Authorization: `Bearer ${token}` },
  });
}

export async function solicitarRecuperacionContrasena(email: string): Promise<{ detail: string }> {
  return solicitar("/auth/contrasena/recuperar", {
    method: "POST",
    body: JSON.stringify({ email }),
  });
}

export async function restablecerContrasena(uid: string, token: string, password: string, confirmacion: string): Promise<{ detail: string }> {
  return solicitar("/auth/contrasena/restablecer", {
    method: "POST",
    body: JSON.stringify({ uid, token, password, password_confirmacion: confirmacion }),
  });
}

export async function crearPreferencia(
  items: ItemCheckout[],
  nombreComprador: string,
  telefonoComprador: string,
  emailComprador: string,
  medioPago: MedioPago["id"],
  claveCheckout: string,
  token?: string | null,
  entrega?: {
    forma: "retiro" | "envio";
    direccion?: string;
    cotizacionEnvio?: string;
  }
): Promise<ResultadoCheckout> {
  return solicitar<ResultadoCheckout>("/pagos/crear-preferencia", {
    method: "POST",
    ...(token ? { headers: { Authorization: `Bearer ${token}` } } : {}),
    body: JSON.stringify({
      items,
      checkout_key: claveCheckout,
      nombre_comprador: nombreComprador,
      telefono_comprador: telefonoComprador,
      email_comprador: emailComprador,
      medio_pago: medioPago,
      forma_entrega: entrega?.forma ?? "retiro",
      ...(entrega?.forma === "envio"
        ? { direccion_entrega: entrega.direccion, cotizacion_envio: entrega.cotizacionEnvio }
        : {}),
    }),
  });
}

export async function verificarPagoRetorno(pedidoId: string, token: string, pagoId: string): Promise<EstadoRetornoPago> {
  const query = new URLSearchParams({ pedido_id: pedidoId, token, payment_id: pagoId });
  return solicitar<EstadoRetornoPago>(`/pagos/verificar-retorno?${query.toString()}`);
}

export interface SolicitudAtencionInput {
  tipo: "arrepentimiento" | "reclamo" | "consulta";
  nombre: string;
  email: string;
  telefono?: string;
  numero_pedido?: string;
  mensaje?: string;
}

export async function enviarSolicitudAtencion(datos: SolicitudAtencionInput): Promise<{ id: number; detail: string }> {
  return solicitar("/atencion/solicitudes", {
    method: "POST",
    body: JSON.stringify(datos),
  });
}

interface EstadoAdministracion {
  activo: boolean;
  imagen_url: string;
  actualizado: string;
}

export type ProductoAdministracion = Producto & EstadoAdministracion;
export type ComboAdministracion = Omit<Combo, "productos"> & EstadoAdministracion & { productos: number[]; stock: number };
export type ArticuloAdministracion = ProductoAdministracion | ComboAdministracion;
export type RecursoAdministracion = "productos" | "combos";
export interface ImagenSaborUpload { indice: number; archivo: File }

export async function listarCatalogoAdministracion(token: string) {
  const headers = { Authorization: `Bearer ${token}` };
  const [productos, combos, categorias] = await Promise.all([
    solicitar<ProductoAdministracion[]>("/administracion/productos/", { headers }),
    solicitar<ComboAdministracion[]>("/administracion/combos/", { headers }),
    solicitar<Categoria[]>("/administracion/categorias/", { headers }),
  ]);
  return { productos, combos, categorias };
}

export async function guardarArticuloAdministracion(
  token: string,
  recurso: RecursoAdministracion,
  id: number | null,
  datos: Record<string, unknown>,
  imagen?: File | null,
  imagenesSabores: ImagenSaborUpload[] = [],
): Promise<ArticuloAdministracion> {
  let body: string | FormData = JSON.stringify(datos);
  if (imagen || imagenesSabores.length) {
    body = new FormData();
    body.append("datos", JSON.stringify(datos));
    if (imagen) body.append("imagen_archivo", imagen);
    for (const { indice, archivo } of imagenesSabores) body.append(`sabor_imagen_${indice}`, archivo);
  }
  return solicitar(`/administracion/${recurso}/${id === null ? "" : `${id}/`}`, {
    method: id === null ? "POST" : "PATCH",
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
}

export async function eliminarArticuloAdministracion(token: string, recurso: RecursoAdministracion, id: number): Promise<void> {
  return solicitar(`/administracion/${recurso}/${id}/`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${token}` },
  });
}
