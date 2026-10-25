"use client";

import { useEffect, useMemo, useState } from "react";
import { Minus, Plus, Search, Trash2 } from "lucide-react";
import { ApiError, listarCatalogoAdministracion, registrarVentaMostrador, type ArticuloAdministracion, type VentaMostrador } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

type Linea = { clave: string; tipo: "producto" | "combo"; id: number; nombre: string; precio: number; cantidad: number; sabor: string; sabores: string[] };
const dinero = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const control = "min-h-11 rounded-lg border border-carbon-line bg-carbon px-3 py-2 text-sm outline-none focus:border-ember";

export default function VentaMostradorPanel({ token }: { token: string }) {
  const cerrarSesion = useAuthStore((s) => s.cerrarSesion);
  const [articulos, setArticulos] = useState<{ tipo: "producto" | "combo"; a: ArticuloAdministracion }[] | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [medio, setMedio] = useState<VentaMostrador["medio_pago"]>("local");
  const [cliente, setCliente] = useState({ nombre: "", telefono: "" });
  const [ventaKey, setVentaKey] = useState(() => crypto.randomUUID());
  const [confirmando, setConfirmando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [revision, setRevision] = useState(0);

  function reportar(e: unknown) {
    if (e instanceof ApiError && e.status === 401) cerrarSesion(); else setError(e instanceof Error ? e.message : "No pudimos completar la operación.");
  }

  useEffect(() => {
    let vigente = true;
    listarCatalogoAdministracion(token).then(({ productos, combos }) => {
      if (vigente) setArticulos([...productos.map((a) => ({ tipo: "producto" as const, a })), ...combos.map((a) => ({ tipo: "combo" as const, a }))].filter(({ a }) => a.activo));
    }).catch((e: unknown) => {
      if (!vigente) return;
      if (e instanceof ApiError && e.status === 401) cerrarSesion(); else setError(e instanceof Error ? e.message : "No pudimos cargar el catálogo.");
    });
    return () => { vigente = false; };
  }, [token, revision, cerrarSesion]);

  const termino = busqueda.trim().toLocaleLowerCase("es-AR");
  const resultados = useMemo(() => termino ? (articulos ?? []).filter(({ a }) => a.nombre.toLocaleLowerCase("es-AR").includes(termino)).slice(0, 8) : [], [articulos, termino]);
  const total = lineas.reduce((suma, l) => suma + l.precio * l.cantidad, 0);

  function agregar(tipo: Linea["tipo"], a: ArticuloAdministracion) {
    // Los sabores viejos se guardaron como texto; los nuevos, como {nombre, imagen}.
    const sabores = "sabores" in a ? (a.sabores ?? []).map((s: string | { nombre: string }) => typeof s === "string" ? s : s.nombre) : [];
    const sabor = sabores[0] ?? "";
    setLineas((actual) => {
      const existente = actual.find((l) => l.tipo === tipo && l.id === a.id && l.sabor === sabor);
      return existente ? actual.map((l) => l === existente ? { ...l, cantidad: Math.min(20, l.cantidad + 1) } : l)
        : [...actual, { clave: `${tipo}-${a.id}-${Date.now()}`, tipo, id: a.id, nombre: a.nombre, precio: a.precio, cantidad: 1, sabor, sabores }];
    });
    setBusqueda(""); setMensaje(""); setError(""); setConfirmando(false);
  }
  const cambiar = (clave: string, cambio: Partial<Linea>) => { setLineas((actual) => actual.map((l) => l.clave === clave ? { ...l, ...cambio } : l)); setConfirmando(false); };

  async function confirmar() {
    setGuardando(true); setError("");
    try {
      const venta = await registrarVentaMostrador(token, {
        venta_key: ventaKey, medio_pago: medio, nombre_comprador: cliente.nombre.trim(), telefono_comprador: cliente.telefono.trim(),
        items: lineas.map(({ tipo, id, cantidad, sabor }) => ({ tipo, id, cantidad, ...(sabor ? { sabor } : {}) })),
      });
      setMensaje(`Venta #${venta.pedido_id} registrada por ${dinero(venta.total)}. El stock ya se descontó.`);
      setLineas([]); setCliente({ nombre: "", telefono: "" }); setVentaKey(crypto.randomUUID()); setConfirmando(false); setRevision((r) => r + 1);
    } catch (e) { reportar(e); setConfirmando(false); }
    finally { setGuardando(false); }
  }

  const stockDe = (tipo: Linea["tipo"], id: number) => articulos?.find((x) => x.tipo === tipo && x.a.id === id)?.a.stock ?? 0;

  return <section aria-labelledby="mostrador-titulo">
    <h2 id="mostrador-titulo" className="font-display text-2xl font-semibold">Venta en mostrador</h2>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-bone-dim">Cargá lo que vendiste en el local: descuenta el stock y suma en el Resumen. Si te equivocás, la anulás desde Pedidos y el stock vuelve.</p>
    {mensaje && <p role="status" className="mt-5 rounded-lg border border-signal/40 p-4 text-sm text-signal">{mensaje}</p>}
    {error && <p role="alert" className="mt-5 rounded-lg border border-ember/40 p-4 text-sm text-ember">{error}</p>}
    <div className="mt-6 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <div className="rounded-xl border border-carbon-line bg-carbon-raised p-5">
        <label className="relative block"><span className="sr-only">Buscar producto o combo</span>
          <Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-bone-dim" />
          <input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} disabled={!articulos} placeholder={articulos ? "Buscá un producto o combo…" : "Cargando catálogo…"} className={`${control} w-full pl-10`} />
        </label>
        {termino && <ul className="mt-3 divide-y divide-carbon-line">
          {resultados.length === 0 ? <li className="py-3 text-sm text-bone-dim">Sin resultados.</li> : resultados.map(({ tipo, a }) => <li key={`${tipo}-${a.id}`}>
            <button type="button" disabled={a.stock <= 0} onClick={() => agregar(tipo, a)} className="flex w-full items-center justify-between gap-3 py-3 text-left text-sm hover:text-ember disabled:opacity-40">
              <span className="min-w-0"><span className="block break-words font-medium">{a.nombre}</span><span className="text-xs text-bone-dim">{tipo === "combo" ? "Combo · " : ""}{a.stock > 0 ? `${a.stock} en stock` : "Sin stock"}</span></span>
              <strong className="shrink-0">{dinero(a.precio)}</strong>
            </button>
          </li>)}
        </ul>}
      </div>
      <div className="rounded-xl border border-carbon-line bg-carbon-raised p-5">
        {lineas.length === 0 ? <p className="py-6 text-center text-sm text-bone-dim">Buscá y agregá lo que se vendió.</p> : <ul className="divide-y divide-carbon-line">
          {lineas.map((l) => <li key={l.clave} className="py-3 text-sm">
            <div className="flex items-start justify-between gap-3"><span className="min-w-0 break-words font-medium">{l.nombre}</span><strong className="shrink-0">{dinero(l.precio * l.cantidad)}</strong></div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <div className="flex items-center border border-carbon-line">
                <button type="button" aria-label="Restar uno" onClick={() => cambiar(l.clave, { cantidad: Math.max(1, l.cantidad - 1) })} className="p-2 hover:text-ember"><Minus size={14} /></button>
                <span className="w-8 text-center tabular-nums">{l.cantidad}</span>
                <button type="button" aria-label="Sumar uno" disabled={l.cantidad >= Math.min(20, stockDe(l.tipo, l.id))} onClick={() => cambiar(l.clave, { cantidad: l.cantidad + 1 })} className="p-2 hover:text-ember disabled:opacity-30"><Plus size={14} /></button>
              </div>
              {l.sabores.length > 0 && <label><span className="sr-only">Sabor de {l.nombre}</span><select value={l.sabor} onChange={(e) => cambiar(l.clave, { sabor: e.target.value })} className={control}>{l.sabores.map((s) => <option key={s}>{s}</option>)}</select></label>}
              <button type="button" aria-label={`Quitar ${l.nombre}`} onClick={() => { setLineas((actual) => actual.filter((x) => x.clave !== l.clave)); setConfirmando(false); }} className="ml-auto p-2 text-bone-dim hover:text-ember"><Trash2 size={16} /></button>
            </div>
          </li>)}
        </ul>}
        <fieldset className="mt-4 border-t border-carbon-line pt-4" disabled={guardando}>
          <legend className="sr-only">Medio de pago</legend>
          <div className="flex gap-2" role="group" aria-label="Medio de pago">
            {([["local", "Efectivo"], ["transferencia", "Transferencia"]] as const).map(([valor, nombre]) => <button key={valor} type="button" aria-pressed={medio === valor} onClick={() => { setMedio(valor); setConfirmando(false); }} className={`flex-1 rounded-md border px-3 py-2.5 text-sm ${medio === valor ? "border-ember bg-ember text-white" : "border-carbon-line text-bone-dim hover:text-bone"}`}>{nombre}</button>)}
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <label className="text-xs text-bone-dim">Cliente (opcional)<input value={cliente.nombre} maxLength={150} onChange={(e) => setCliente({ ...cliente, nombre: e.target.value })} className={`${control} mt-1 w-full`} /></label>
            <label className="text-xs text-bone-dim">Teléfono (opcional)<input type="tel" value={cliente.telefono} maxLength={30} onChange={(e) => setCliente({ ...cliente, telefono: e.target.value })} className={`${control} mt-1 w-full`} /></label>
          </div>
          <p className="mt-4 flex justify-between font-display text-xl font-semibold"><span>Total</span><span>{dinero(total)}</span></p>
          {!confirmando ? <button type="button" disabled={lineas.length === 0} onClick={() => setConfirmando(true)} className="mt-4 w-full rounded-lg bg-ember px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">Registrar venta</button>
            : <div className="mt-4 rounded-lg border border-ember/40 bg-carbon p-4 text-sm">
              <p>¿Registrar la venta por <b>{dinero(total)}</b> en {medio === "local" ? "efectivo" : "transferencia"}? Se descuenta el stock.</p>
              <div className="mt-3 flex gap-3"><button type="button" onClick={() => void confirmar()} className="rounded-lg bg-ember px-4 py-2.5 text-sm font-semibold text-white">{guardando ? "Registrando…" : "Confirmar"}</button><button type="button" onClick={() => setConfirmando(false)} className="px-3 text-sm text-bone-dim hover:text-bone">Volver</button></div>
            </div>}
        </fieldset>
      </div>
    </div>
  </section>;
}
