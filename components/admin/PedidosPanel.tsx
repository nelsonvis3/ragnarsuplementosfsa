"use client";

import { useEffect, useState, type FormEvent } from "react";
import { RefreshCw, Search, ShoppingBag } from "lucide-react";
import { ApiError, gestionarPedidoAdministracion, listarPedidosAdministracion, type AccionPedido, type ListaPedidos, type PedidoAdministracion } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const estados = [
  ["", "Todos los estados"], ["pendiente", "Pendientes"], ["aprobado", "Pagos confirmados"],
  ["revisar_stock", "Revisar stock"], ["revision_pago", "Revisar pago"], ["cancelado", "Cancelados"],
  ["rechazado", "Rechazados"], ["reembolsado", "Reembolsados"], ["contracargo", "Contracargos"],
];
const acciones: Record<AccionPedido, { titulo: string; descripcion: string }> = {
  aprobar: { titulo: "Confirmar pago recibido", descripcion: "Confirmá que recibiste el dinero. Se aprobará el pedido y se notificará al cliente por correo." },
  cancelar: { titulo: "Cancelar pedido", descripcion: "Se cancelará el pedido y se devolverán al inventario las unidades reservadas." },
  completar_stock: { titulo: "Completar con stock repuesto", descripcion: "El pago ya fue aprobado por Mercado Pago. Se descontarán las unidades necesarias del inventario actual." },
  consultar_pago: { titulo: "Consultar Mercado Pago", descripcion: "Se consultará el pago asociado y se actualizará el pedido según la respuesta del proveedor." },
  cerrar_sin_pago: { titulo: "Cerrar revisión sin pago", descripcion: "Usá esta opción únicamente después de verificar en Mercado Pago que no existe un pago aprobado. Se liberará la reserva." },
  cerrar_reembolsado: { titulo: "Registrar reembolso verificado", descripcion: "Esta acción registra una devolución que ya realizaste en Mercado Pago. No devuelve dinero por sí misma." },
  anular_mostrador: { titulo: "Anular venta", descripcion: "Usalo si cargaste la venta por error: queda cancelada y las unidades vuelven al stock." },
};
const dinero = (valor: number) => valor.toLocaleString("es-AR", { style: "currency", currency: "ARS" });
const fecha = (valor: string) => new Date(valor).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
const control = "min-h-11 rounded-lg border border-carbon-line bg-carbon px-3 py-2 text-sm outline-none focus:border-ember";

function Estado({ pedido }: { pedido: PedidoAdministracion }) {
  return <span className={`inline-block rounded-md border px-2.5 py-1 text-xs font-semibold ${pedido.estado === "aprobado" ? "border-signal/40 text-signal" : pedido.estado === "pendiente" ? "border-carbon-line text-bone" : "border-ember/40 text-ember"}`}>{pedido.estado_nombre}</span>;
}

export default function PedidosPanel({ token }: { token: string }) {
  const [estado, setEstado] = useState("");
  const [busqueda, setBusqueda] = useState("");
  const [consulta, setConsulta] = useState("");
  const [pagina, setPagina] = useState(1);
  const [revision, setRevision] = useState(0);
  const [carga, setCarga] = useState<{ clave: string; datos: ListaPedidos } | null>(null);
  const [falloCarga, setFalloCarga] = useState<{ clave: string; mensaje: string } | null>(null);
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [accion, setAccion] = useState<AccionPedido | null>(null);
  const [verificado, setVerificado] = useState(false);
  const [ocupado, setOcupado] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const cerrarSesion = useAuthStore((state) => state.cerrarSesion);
  const clave = JSON.stringify([estado, consulta, pagina, revision, token]);
  const datos = carga?.clave === clave ? carga.datos : null;
  const fallo = falloCarga?.clave === clave ? falloCarga.mensaje : "";
  const pedido = datos?.results.find((p) => p.id === seleccion) ?? null;

  useEffect(() => {
    let vigente = true;
    listarPedidosAdministracion(token, estado, consulta, pagina).then((datos) => {
      if (vigente) setCarga({ clave, datos });
    }).catch((err: unknown) => {
      if (!vigente) return;
      if (err instanceof ApiError && err.status === 401) cerrarSesion();
      else setFalloCarga({ clave, mensaje: err instanceof Error ? err.message : "No pudimos cargar los pedidos." });
    });
    return () => { vigente = false; };
  }, [token, estado, consulta, pagina, clave, cerrarSesion]);

  function refrescar() { setAccion(null); setRevision((valor) => valor + 1); }
  function buscar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setConsulta(busqueda.trim()); setPagina(1); setSeleccion(null); refrescar();
  }
  async function gestionar() {
    if (!pedido || !accion || ocupado) return;
    setOcupado(true); setError(""); setMensaje("");
    try {
      const respuesta = await gestionarPedidoAdministracion(token, pedido, accion, verificado);
      setMensaje(`${pedido.nombre_pedido}: ${respuesta.detail}`);
    } catch (err) {
      if (err instanceof ApiError && err.status === 401) cerrarSesion();
      else setError(err instanceof Error ? err.message : "No pudimos actualizar el pedido.");
    } finally { setOcupado(false); setVerificado(false); refrescar(); }
  }

  return <section aria-labelledby="pedidos-titulo">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="pedidos-titulo" className="font-display text-2xl font-semibold">Pedidos de la tienda</h2><p className="mt-2 text-sm text-bone-dim">Consultá cada compra, verificá los pagos y coordiná la entrega.</p></div>
      <button type="button" disabled={ocupado} onClick={refrescar} className={`${control} inline-flex items-center gap-2 disabled:opacity-50`}><RefreshCw size={16} /> Actualizar pedidos</button>
    </div>
    <form onSubmit={buscar} className="mt-6 flex flex-wrap gap-3">
      <fieldset disabled={ocupado} className="grid w-full min-w-0 items-end gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]">
        <label className="min-w-0 flex-[2] text-sm" htmlFor="pedidos-buscar">Buscar pedido
          <input id="pedidos-buscar" maxLength={150} value={busqueda} onChange={(e) => setBusqueda(e.target.value)} className={`${control} mt-2 w-full`} placeholder="Producto, cliente o referencia" />
        </label>
        <label className="min-w-0 flex-1 text-sm" htmlFor="pedidos-estado">Estado
          <select id="pedidos-estado" value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(1); setSeleccion(null); setAccion(null); }} className={`${control} mt-2 w-full`}>
            {estados.map(([valor, etiqueta]) => <option key={valor} value={valor}>{etiqueta}</option>)}
          </select>
        </label>
        <button type="submit" className={`${control} inline-flex items-center gap-2 border-ember text-ember`}><Search size={16} /> Buscar</button>
      </fieldset>
    </form>
    {mensaje && <p role="status" className="mt-5 rounded-lg border border-signal/40 p-4 text-sm text-signal">{mensaje}</p>}
    {(error || fallo) && <p role="alert" className="mt-5 rounded-lg border border-ember/40 p-4 text-sm text-ember">{error || fallo}</p>}
    {!datos && !fallo && <p role="status" className="mt-8 text-sm text-bone-dim">Cargando pedidos…</p>}
    {datos && <>
      <p className="mt-5 text-xs text-bone-dim">{datos.count} pedido(s) · página {pagina}</p>
      <div className="mt-3 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <div className="min-w-0 overflow-hidden rounded-xl border border-carbon-line bg-carbon-raised">
          {datos.results.length === 0 ? <div className="p-8 text-center"><ShoppingBag size={28} className="mx-auto text-bone-dim" /><p className="mt-4 text-sm text-bone-dim">No hay pedidos que coincidan con estos filtros.</p></div> :
            <ul>{datos.results.map((item) => <li key={item.id} className="border-b border-carbon-line last:border-0">
              <button type="button" disabled={ocupado} aria-pressed={seleccion === item.id} onClick={() => { setSeleccion(item.id); setAccion(null); setVerificado(false); }} className={`w-full p-5 text-left transition-colors hover:bg-carbon disabled:opacity-60 ${seleccion === item.id ? "border-l-4 border-ember bg-carbon" : "border-l-4 border-transparent"}`}>
                <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-xs text-bone-dim">Referencia {item.id} · {fecha(item.creado)}{item.canal === "mostrador" && " · Mostrador"}</span><Estado pedido={item} /></div>
                <p className="mt-3 break-words font-display text-base font-semibold">{item.nombre_pedido}</p>
                <div className="mt-3 flex flex-wrap justify-between gap-2 text-sm"><span className="break-words text-bone-dim">{item.nombre_comprador}</span><strong>{dinero(item.total)}</strong></div>
              </button>
            </li>)}</ul>}
          <div className="flex justify-between gap-3 border-t border-carbon-line p-4">
            <button type="button" disabled={!datos.previous || ocupado} onClick={() => { setPagina((n) => n - 1); setSeleccion(null); setAccion(null); }} className={`${control} disabled:opacity-40`}>Anterior</button>
            <button type="button" disabled={!datos.next || ocupado} onClick={() => { setPagina((n) => n + 1); setSeleccion(null); setAccion(null); }} className={`${control} disabled:opacity-40`}>Siguiente</button>
          </div>
        </div>
        <div className="min-w-0 rounded-xl border border-carbon-line bg-carbon-raised p-5 sm:p-6" aria-label="Detalle del pedido">
          {!pedido ? <p className="py-10 text-center text-sm text-bone-dim">Seleccioná un pedido para ver sus productos y gestionarlo.</p> : <>
            <Estado pedido={pedido} />
            <h3 className="mt-4 break-words font-display text-xl font-semibold">{pedido.nombre_pedido}</h3>
            <p className="mt-2 text-xs text-bone-dim">Referencia {pedido.id} · {fecha(pedido.creado)}</p>
            <dl className="mt-6 space-y-3 text-sm">
              <div><dt className="text-bone-dim">Cliente</dt><dd className="mt-1 break-words font-medium">{pedido.nombre_comprador}</dd></div>
              {pedido.email_comprador && <div><dt className="text-bone-dim">Email</dt><dd className="mt-1 break-all"><a href={`mailto:${pedido.email_comprador}`} className="underline underline-offset-4">{pedido.email_comprador}</a></dd></div>}
              {pedido.telefono_comprador && <div><dt className="text-bone-dim">Teléfono</dt><dd className="mt-1 break-words">{pedido.telefono_comprador}</dd></div>}
              <div><dt className="text-bone-dim">Entrega</dt><dd className="mt-1 break-words">{pedido.canal === "mostrador" ? "Venta en mostrador" : `${pedido.entrega_nombre}${pedido.direccion_entrega ? ` · ${pedido.direccion_entrega}` : ""}`}</dd></div>
              <div><dt className="text-bone-dim">Medio de pago</dt><dd className="mt-1">{pedido.medio_pago_nombre}</dd></div>
              {pedido.pago_id && <div><dt className="text-bone-dim">ID del pago en Mercado Pago</dt><dd className="mt-1 break-all">{pedido.pago_id}</dd></div>}
            </dl>
            <ul className="mt-6 divide-y divide-carbon-line border-y border-carbon-line">
              {pedido.items.map((item, i) => <li key={i} className="flex items-start justify-between gap-3 py-3 text-sm"><span className="min-w-0 break-words">{item.cantidad} × {item.nombre}{item.sabor ? ` (${item.sabor})` : ""}</span><strong className="shrink-0">{dinero(item.precio_unitario * item.cantidad)}</strong></li>)}
            </ul>
            <p className="mt-4 flex justify-between gap-3 text-sm text-bone-dim"><span>Envío</span><span>{dinero(pedido.costo_envio)}</span></p>
            {pedido.descuento > 0 && <p className="mt-2 flex justify-between gap-3 text-sm text-signal"><span>Premio del juego</span><span>−{dinero(pedido.descuento)}</span></p>}
            <p className="mt-2 flex justify-between gap-3 font-semibold"><span>Total</span><span>{dinero(pedido.total)}</span></p>
            {pedido.stock_reservado && <p className="mt-4 text-xs leading-6 text-bone-dim">Stock reservado{pedido.stock_reservado_hasta ? ` hasta ${fecha(pedido.stock_reservado_hasta)}` : ""}.</p>}
            {pedido.pagos_adicionales.length > 0 && <p className="mt-4 text-sm text-ember">Este pedido registra pagos adicionales. Revisalos en Mercado Pago antes de coordinar la entrega.</p>}
            <div className="mt-6 border-t border-carbon-line pt-5">
              {pedido.acciones.length === 0 ? <p className="text-sm leading-6 text-bone-dim">{pedido.estado === "aprobado" ? "Pago confirmado. Usá los datos del cliente para coordinar la entrega. El pedido se conserva en el historial." : pedido.proveedor_pago === "mercado_pago" && pedido.estado === "pendiente" ? "Esperando la confirmación de Mercado Pago. El estado se actualiza al recibir la notificación del proveedor." : "Este pedido se conserva en el historial y no tiene acciones pendientes."}</p> : <div className="flex flex-wrap gap-2">{pedido.acciones.map((valor) => <button key={valor} type="button" disabled={ocupado} onClick={() => { setAccion(valor); setVerificado(false); }} className={`${control} border-ember text-ember disabled:opacity-50`}>{acciones[valor].titulo}</button>)}</div>}
              {accion && <div className="mt-4 rounded-lg border border-ember/40 bg-carbon p-4">
                <h4 className="text-sm font-semibold">{acciones[accion].titulo}</h4>
                <p className="mt-2 text-sm leading-6 text-bone-dim">{acciones[accion].descripcion}</p>
                {accion.startsWith("cerrar_") && <label className="mt-4 flex items-start gap-3 text-sm"><input type="checkbox" checked={verificado} disabled={ocupado} onChange={(e) => setVerificado(e.target.checked)} className="mt-1" /> Verifiqué el estado y la devolución, si corresponde, en Mercado Pago.</label>}
                <div className="mt-4 flex flex-wrap gap-3"><button type="button" disabled={ocupado || (accion.startsWith("cerrar_") && !verificado)} onClick={() => void gestionar()} className="rounded-lg bg-ember px-4 py-3 text-sm font-semibold text-white disabled:opacity-50">{ocupado ? "Actualizando…" : "Confirmar acción"}</button><button type="button" disabled={ocupado} onClick={() => setAccion(null)} className={control}>Volver</button></div>
              </div>}
            </div>
          </>}
        </div>
      </div>
    </>}
  </section>;
}
