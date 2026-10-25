"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Search, Users } from "lucide-react";
import { ApiError, listarClientes, type ClientePanel } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const dinero = (n: number) => n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
const fecha = (valor: string) => new Date(valor).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });

export default function ClientesPanel({ token }: { token: string }) {
  const cerrarSesion = useAuthStore((s) => s.cerrarSesion);
  const [busqueda, setBusqueda] = useState("");
  const [consulta, setConsulta] = useState("");
  const [carga, setCarga] = useState<{ consulta: string; filas: ClientePanel[] } | null>(null);
  const [error, setError] = useState("");
  const filas = carga?.consulta === consulta ? carga.filas : null;

  useEffect(() => {
    let vigente = true;
    listarClientes(token, consulta).then((filas) => { if (vigente) { setCarga({ consulta, filas }); setError(""); } }).catch((e: unknown) => {
      if (!vigente) return;
      if (e instanceof ApiError && e.status === 401) cerrarSesion(); else setError(e instanceof Error ? e.message : "No pudimos cargar los clientes.");
    });
    return () => { vigente = false; };
  }, [token, consulta, cerrarSesion]);

  function buscar(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setConsulta(busqueda.trim()); }

  return <section aria-labelledby="clientes-titulo">
    <h2 id="clientes-titulo" className="font-display text-2xl font-semibold">Clientes</h2>
    <p className="mt-2 text-sm text-bone-dim">Cuentas registradas en la tienda, de la más nueva a la más vieja. Las compras cuentan solo pedidos aprobados.</p>
    <form onSubmit={buscar} className="mt-6 flex gap-2">
      <label className="relative min-w-0 flex-1"><span className="sr-only">Buscar cliente</span>
        <Search size={17} className="pointer-events-none absolute left-3 top-3.5 text-bone-dim" />
        <input type="search" value={busqueda} maxLength={100} onChange={(e) => setBusqueda(e.target.value)} placeholder="Nombre o email" className="min-h-11 w-full rounded-lg border border-carbon-line bg-carbon py-2 pl-10 pr-3 text-sm outline-none focus:border-ember" />
      </label>
      <button type="submit" className="min-h-11 rounded-lg border border-ember px-4 text-sm text-ember">Buscar</button>
    </form>
    {error && <p role="alert" className="mt-5 rounded-lg border border-ember/40 p-4 text-sm text-ember">{error}</p>}
    {!filas ? !error && <p role="status" className="mt-6 text-sm text-bone-dim">Cargando clientes…</p> : filas.length === 0 ?
      <div className="mt-5 rounded-xl border border-carbon-line bg-carbon-raised p-10 text-center"><Users size={28} className="mx-auto text-bone-dim" /><p className="mt-4 text-sm text-bone-dim">{consulta ? "No hay clientes con esa búsqueda." : "Todavía no hay cuentas registradas."}</p></div> :
      <ul className="mt-5 divide-y divide-carbon-line rounded-xl border border-carbon-line bg-carbon-raised">{filas.map((c) => <li key={c.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 p-4 text-sm">
        <div className="min-w-0">
          <p className="break-words font-medium">{c.nombre}{!c.email_confirmado && <span className="ml-2 rounded-md border border-carbon-line px-2 py-0.5 text-xs text-bone-dim">Email sin confirmar</span>}</p>
          <a href={`mailto:${c.email}`} className="break-all text-xs text-ember underline underline-offset-4">{c.email}</a>
          <p className="mt-1 text-xs text-bone-dim">Alta: {fecha(c.alta)}{c.ultima_compra && ` · Última compra: ${fecha(c.ultima_compra)}`}</p>
        </div>
        <div className="text-right"><p className="font-display text-lg font-semibold">{dinero(c.gastado)}</p><p className="text-xs text-bone-dim">{c.compras} compra{c.compras === 1 ? "" : "s"}</p></div>
      </li>)}</ul>}
    {filas && filas.length === 200 && <p className="mt-3 text-xs text-bone-dim">Se muestran los 200 más recientes. Usá la búsqueda para encontrar a alguien en particular.</p>}
  </section>;
}
