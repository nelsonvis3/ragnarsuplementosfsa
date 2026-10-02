import type { Combo, Producto } from "@/types/producto";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://127.0.0.1:8000";

export interface Usuario {
  id: number;
  nombre_completo: string;
  email: string;
}

export interface AuthResponse {
  token: string;
  usuario: Usuario;
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
  if (opciones.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  try {
    respuesta = await fetch(`${API_URL}${ruta}`, {
      ...opciones,
      cache: "no-store",
      headers,
    });
  } catch {
    throw new ApiError("No pudimos conectar con Django. Comprobá que el backend esté activo.");
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
): Promise<AuthResponse> {
  return solicitar<AuthResponse>("/auth/registro", {
    method: "POST",
    body: JSON.stringify({ nombre_completo: nombreCompleto, email, password }),
  });
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
