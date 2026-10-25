"use client";

import { useEffect, useState } from "react";
import { Inbox, RefreshCw } from "lucide-react";
import { ApiError, actualizarSolicitud, listarSolicitudes, type SolicitudPanel } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const filtros = [["", "Todas"], ["pendiente", "Pendientes"], ["en_proceso", "En proceso"], ["resuelta", "Resueltas"]] as const;
const estados: [SolicitudPanel["estado"], string][] = [["pendiente", "Pendiente"], ["en_proceso", "En proceso"], ["resuelta", "Resuelta"]];
const fecha = (valor: string) => new Date(valor).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" });
const control = "min-h-11 rounded-lg border border-carbon-line bg-carbon px-3 py-2 text-sm outline-none focus:border-ember";

export default function AtencionPanel({ token }: { token: string }) {
  const cerrarSesion = useAuthStore((s) => s.cerrarSesion);
  const [estado, setEstado] = useState("");
  const [revision, setRevision] = useState(0);
  const clave = `${estado}-${revision}`;
  const [carga, setCarga] = useState<{ clave: string; filas: SolicitudPanel[] } | null>(null);
  const [guardando, setGuardando] = useState<number | null>(null);
  const [error, setError] = useState("");
  const filas = carga?.clave === clave ? carga.filas : null;

  function reportar(e: unknown) {
    if (e instanceof ApiError && e.status === 401) cerrarSesion();
    else setError(e instanceof Error ? e.message : "No pudimos cargar las consultas.");
  }

  useEffect(() => {
    let vigente = true;
    listarSolicitudes(token, estado).then((filas) => { if (vigente) { setCarga({ clave, filas }); setError(""); } }).catch((e: unknown) => {
      if (!vigente) return;
      if (e instanceof ApiError && e.status === 401) cerrarSesion(); else setError(e instanceof Error ? e.message : "No pudimos cargar las consultas.");
    });
    return () => { vigente = false; };
  }, [token, estado, clave, cerrarSesion]);

  async function cambiar(solicitud: SolicitudPanel, nuevo: SolicitudPanel["estado"]) {
    setGuardando(solicitud.id); setError("");
    try {
      const actualizada = await actualizarSolicitud(token, solicitud.id, nuevo);
      // Con un filtro activo, la consulta sale de la lista al cambiar de estado.
      setCarga((c) => c && { ...c, filas: c.filas.flatMap((f) => f.id !== solicitud.id ? [f] : !estado || actualizada.estado === estado ? [actualizada] : []) });
    } catch (e) { reportar(e); }
    finally { setGuardando(null); }
  }

  return <section aria-labelledby="atencion-titulo">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h2 id="atencion-titulo" className="font-display text-2xl font-semibold">Atención al cliente</h2><p className="mt-2 text-sm text-bone-dim">Consultas, reclamos y pedidos de arrepentimiento enviados desde la tienda.</p></div>
      <button type="button" onClick={() => setRevision((r) => r + 1)} className={`${control} inline-flex items-center gap-2`}><RefreshCw size={16} /> Actualizar</button>
    </div>
    <div className="mt-6 flex flex-wrap gap-1" role="group" aria-label="Filtrar por estado">
      {filtros.map(([valor, etiqueta]) => <button key={valor} type="button" aria-pressed={estado === valor} onClick={() => setEstado(valor)} className={`rounded-md border px-3 py-2 text-sm ${estado === valor ? "border-ember bg-ember text-white" : "border-carbon-line text-bone-dim hover:text-bone"}`}>{etiqueta}</button>)}
    </div>
    {error && <p role="alert" className="mt-5 rounded-lg border border-ember/40 p-4 text-sm text-ember">{error}</p>}
    {!filas ? !error && <p role="status" className="mt-6 text-sm text-bone-dim">Cargando consultas…</p> : filas.length === 0 ?
      <div className="mt-5 rounded-xl border border-carbon-line bg-carbon-raised p-10 text-center"><Inbox size={28} className="mx-auto text-bone-dim" /><p className="mt-4 text-sm text-bone-dim">No hay consultas {estado ? "con este estado" : "todavía"}.</p></div> :
      <ul className="mt-5 grid gap-3">{filas.map((s) => <li key={s.id} className={`rounded-xl border bg-carbon-raised p-5 ${s.estado === "pendiente" ? "border-ember/40" : "border-carbon-line"}`}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0"><p className="text-xs uppercase tracking-wider text-ember">{s.tipo_nombre}</p><h3 className="mt-1 break-words font-display text-lg font-semibold">{s.nombre}</h3><p className="mt-1 text-xs text-bone-dim">{fecha(s.creado)}{s.numero_pedido && ` · Pedido ${s.numero_pedido}`}</p></div>
          <label className="text-sm"><span className="sr-only">Estado de la consulta de {s.nombre}</span>
            <select value={s.estado} disabled={guardando === s.id} onChange={(e) => void cambiar(s, e.target.value as SolicitudPanel["estado"])} className={`${control} disabled:opacity-50`}>{estados.map(([v, t]) => <option key={v} value={v}>{t}</option>)}</select>
          </label>
        </div>
        {s.mensaje && <p className="mt-4 whitespace-pre-line break-words text-sm leading-6">{s.mensaje}</p>}
        <p className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-sm"><a href={`mailto:${s.email}`} className="break-all text-ember underline underline-offset-4">{s.email}</a>{s.telefono && <a href={`tel:${s.telefono}`} className="underline underline-offset-4">{s.telefono}</a>}</p>
      </li>)}</ul>}
  </section>;
}
