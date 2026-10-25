"use client";

import { useEffect, useState } from "react";
import { ApiError, obtenerResumen, type ResumenPanel as Datos } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const dinero = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const numero = (n: number) => n.toLocaleString("es-AR");
const dia = (d: string) => new Date(`${d}T12:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" });

/** One measure per chart (sales and visitors never share an axis). */
function Barras({ titulo, serie, valor, formato }: { titulo: string; serie: Datos["serie"]; valor: (p: Datos["serie"][number]) => number; formato: (n: number) => string }) {
  const [activo, setActivo] = useState<number | null>(null);
  const max = Math.max(1, ...serie.map(valor));
  const ancho = 100 / Math.max(serie.length, 1);
  const punto = activo !== null ? serie[activo] : null;
  return <figure className="m-0 rounded-xl border border-carbon-line bg-carbon-raised p-5">
    <figcaption className="flex items-baseline justify-between gap-3"><span className="text-sm font-semibold">{titulo}</span><strong className="font-display text-xl">{formato(serie.reduce((s, p) => s + valor(p), 0))}</strong></figcaption>
    <div className="relative mt-4 h-40" onMouseLeave={() => setActivo(null)}>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="h-full w-full overflow-visible" role="img" aria-label={`${titulo} por día`}>
        {[10, 20, 30].map((y) => <line key={y} x1="0" x2="100" y1={y} y2={y} stroke="currentColor" className="text-carbon-line" strokeWidth=".25" vectorEffect="non-scaling-stroke" />)}
        {serie.map((p, i) => { const h = valor(p) / max * 38; return <g key={p.dia} onMouseEnter={() => setActivo(i)}>
          <rect x={i * ancho} y="0" width={ancho} height="40" fill="transparent" />
          <rect x={i * ancho + ancho * .15} y={40 - h} width={ancho * .7} height={h} rx=".6" fill={activo === i ? "#f4f1ec" : "#e0384a"} />
        </g>; })}
      </svg>
      {punto && <div className="pointer-events-none absolute -top-2 rounded-md bg-bone px-2.5 py-1.5 text-xs font-semibold text-carbon" style={{ left: `${Math.min(78, Math.max(0, activo! * ancho - 6))}%` }}>{dia(punto.dia)}: {formato(valor(punto))}</div>}
    </div>
    <div className="mt-2 flex justify-between border-t border-carbon-line pt-2 text-xs text-bone-dim"><span>{serie[0] && dia(serie[0].dia)}</span><span>{serie.at(-1) && dia(serie.at(-1)!.dia)}</span></div>
  </figure>;
}

function Lista({ titulo, filas, vacio }: { titulo: string; filas: [string, string | number][]; vacio: string }) {
  return <section className="rounded-xl border border-carbon-line bg-carbon-raised p-5">
    <h3 className="text-sm font-semibold">{titulo}</h3>
    {filas.length ? <ul className="mt-3 divide-y divide-carbon-line text-sm">{filas.map(([a, b], i) => <li key={`${a}-${i}`} className="flex justify-between gap-3 py-2"><span className="min-w-0 truncate">{a}</span><strong className="shrink-0">{b}</strong></li>)}</ul> : <p className="mt-3 text-sm text-bone-dim">{vacio}</p>}
  </section>;
}

export default function ResumenPanel({ token, irA }: { token: string; irA: (seccion: "pedidos" | "atencion" | "catalogo") => void }) {
  const cerrarSesion = useAuthStore((s) => s.cerrarSesion);
  const [dias, setDias] = useState(30);
  const [datos, setDatos] = useState<{ dias: number; valor: Datos } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    let vigente = true;
    obtenerResumen(token, dias).then((valor) => { if (vigente) { setDatos({ dias, valor }); setError(""); } }).catch((e: unknown) => {
      if (!vigente) return;
      if (e instanceof ApiError && e.status === 401) cerrarSesion(); else setError(e instanceof Error ? e.message : "No pudimos cargar el resumen.");
    });
    return () => { vigente = false; };
  }, [token, dias, cerrarSesion]);
  const d = datos?.dias === dias ? datos.valor : null;

  return <section aria-labelledby="resumen-titulo">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <h2 id="resumen-titulo" className="font-display text-2xl font-semibold">Resumen</h2>
      <div className="flex gap-1" role="group" aria-label="Período">{[7, 30, 90].map((n) => <button key={n} type="button" aria-pressed={dias === n} onClick={() => setDias(n)} className={`rounded-md border px-3 py-2 text-sm ${dias === n ? "border-ember bg-ember text-white" : "border-carbon-line text-bone-dim hover:text-bone"}`}>{n} días</button>)}</div>
    </div>
    {error && <p role="alert" className="mt-5 rounded-lg border border-ember/40 p-4 text-sm text-ember">{error}</p>}
    {!d ? !error && <p role="status" className="mt-6 text-sm text-bone-dim">Cargando estadísticas…</p> : <>
      {(d.por_revisar > 0 || d.consultas_pendientes > 0) && <div className="mt-5 flex flex-wrap gap-3">
        {d.por_revisar > 0 && <button type="button" onClick={() => irA("pedidos")} className="rounded-lg border border-ember/50 bg-ember/10 px-4 py-3 text-left text-sm"><b>{d.por_revisar}</b> {d.por_revisar === 1 ? "pedido espera" : "pedidos esperan"} tu revisión</button>}
        {d.consultas_pendientes > 0 && <button type="button" onClick={() => irA("atencion")} className="rounded-lg border border-carbon-line bg-carbon-raised px-4 py-3 text-left text-sm"><b>{d.consultas_pendientes}</b> {d.consultas_pendientes === 1 ? "consulta sin responder" : "consultas sin responder"}</button>}
      </div>}
      <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[["Cobrado", dinero(d.cobrado), `${numero(d.ventas)} ventas aprobadas`], ["Ticket promedio", dinero(d.ticket_promedio), "Por venta aprobada"], ["Visitantes", numero(d.visitantes), `${numero(d.vistas)} páginas vistas`], ["Conversión", `${d.conversion.toLocaleString("es-AR")}%`, "Ventas sobre visitantes"]].map(([t, v, s]) =>
          <div key={t} className="rounded-xl border border-carbon-line bg-carbon-raised p-5"><p className="text-xs uppercase tracking-wider text-bone-dim">{t}</p><p className="mt-2 font-display text-3xl font-semibold">{v}</p><p className="mt-1 text-xs text-bone-dim">{s}</p></div>)}
      </div>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        <Barras titulo="Ventas aprobadas" serie={d.serie} valor={(p) => p.total} formato={dinero} />
        <Barras titulo="Visitantes únicos" serie={d.serie} valor={(p) => p.visitantes} formato={numero} />
      </div>
      <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <Lista titulo="Más vendidos" filas={d.mas_vendidos.map((p) => [p.nombre, `${p.unidades} u.`])} vacio="Sin ventas aprobadas en el período." />
        <Lista titulo="Medios de pago" filas={d.medios_pago.map((m) => [m.medio, m.pedidos])} vacio="Sin ventas aprobadas en el período." />
        <Lista titulo="Páginas más vistas" filas={d.paginas.map((p) => [p.ruta, p.vistas])} vacio="Todavía no hay visitas registradas." />
        <section className="rounded-xl border border-carbon-line bg-carbon-raised p-5">
          <h3 className="text-sm font-semibold">Stock</h3>
          {d.sin_stock.length + d.stock_bajo.length === 0 ? <p className="mt-3 text-sm text-bone-dim">Todo con stock suficiente.</p> :
            <ul className="mt-3 divide-y divide-carbon-line text-sm">{d.sin_stock.map((p) => <li key={`s${p.id}`} className="flex justify-between gap-3 py-2"><span className="truncate">{p.nombre}</span><strong className="text-ember">Sin stock</strong></li>)}{d.stock_bajo.map((p) => <li key={`b${p.id}`} className="flex justify-between gap-3 py-2"><span className="truncate">{p.nombre}</span><strong>{p.stock} u.</strong></li>)}</ul>}
          <button type="button" onClick={() => irA("catalogo")} className="mt-3 text-sm text-ember underline underline-offset-4">Ajustar stock</button>
        </section>
      </div>
      <section className="mt-3 rounded-xl border border-carbon-line bg-carbon-raised p-5">
        <div className="flex items-center justify-between"><h3 className="text-sm font-semibold">Últimos pedidos</h3><button type="button" onClick={() => irA("pedidos")} className="text-sm text-ember underline underline-offset-4">Ver todos</button></div>
        <ul className="mt-3 divide-y divide-carbon-line text-sm">{d.ultimos.map((p) => <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5"><span>#{p.id} · {p.comprador}<span className="ml-2 text-xs text-bone-dim">{new Date(p.creado).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}</span></span><span className="flex items-center gap-3"><span className={`rounded-md border px-2 py-0.5 text-xs ${p.codigo_estado === "aprobado" ? "border-signal/40 text-signal" : "border-carbon-line text-bone-dim"}`}>{p.estado}</span><strong>{dinero(p.total)}</strong></span></li>)}</ul>
      </section>
      <p className="mt-4 text-xs leading-5 text-bone-dim">Las visitas se cuentan sin cookies ni datos personales: por día y página, con una huella diaria que no guarda la IP. Se excluyen bots conocidos y el panel.</p>
    </>}
  </section>;
}
