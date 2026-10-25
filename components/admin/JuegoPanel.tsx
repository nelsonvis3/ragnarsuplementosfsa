"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiError, guardarJuegoPanel, obtenerJuegoPanel, type JuegoPanel as Datos } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

type Config = Omit<Datos, "premios">;
const premios = [["peso_5", "5 % de descuento"], ["peso_10", "10 % de descuento"], ["peso_envio", "Envío gratis"]] as const;
const fecha = (valor: string) => new Date(valor).toLocaleDateString("es-AR", { day: "numeric", month: "short" });
const configDe = ({ activo, peso_5, peso_10, peso_envio, dias_validez }: Datos): Config => ({ activo, peso_5, peso_10, peso_envio, dias_validez });
const control ="min-h-11 rounded-lg border border-carbon-line bg-carbon px-3 py-2 text-sm outline-none focus:border-ember";

export default function JuegoPanel({ token }: { token: string }) {
  const cerrarSesion = useAuthStore((s) => s.cerrarSesion);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [form, setForm] = useState<Config | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  function reportar(e: unknown) {
    if (e instanceof ApiError && e.status === 401) cerrarSesion();
    else setError(e instanceof Error ? e.message : "No pudimos cargar el juego.");
  }
  function cargar(d: Datos) { setDatos(d); setForm(configDe(d)); }

  useEffect(() => {
    let vigente = true;
    obtenerJuegoPanel(token).then((d) => { if (vigente) { setDatos(d); setForm(configDe(d)); } }).catch((e: unknown) => {
      if (!vigente) return;
      if (e instanceof ApiError && e.status === 401) cerrarSesion(); else setError(e instanceof Error ? e.message : "No pudimos cargar el juego.");
    });
    return () => { vigente = false; };
  }, [token, cerrarSesion]);

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setGuardando(true); setError(""); setMensaje("");
    try { cargar(await guardarJuegoPanel(token, form)); setMensaje("Configuración guardada."); }
    catch (e) { reportar(e); }
    finally { setGuardando(false); }
  }

  if (!datos || !form) return <section><h2 className="font-display text-2xl font-semibold">Juego de cartas</h2>{error ? <p role="alert" className="mt-5 text-sm text-ember">{error}</p> : <p role="status" className="mt-6 text-sm text-bone-dim">Cargando…</p>}</section>;

  const total = form.peso_5 + form.peso_10 + form.peso_envio;
  return <section aria-labelledby="juego-titulo">
    <h2 id="juego-titulo" className="font-display text-2xl font-semibold">Juego de cartas</h2>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-bone-dim">Cada cliente registrado juega una vez al crear la cuenta y otra por cada compra aprobada de 5 productos o más. El sorteo se hace en el servidor con estas probabilidades.</p>
    <form onSubmit={guardar} className="mt-6 rounded-xl border border-carbon-line bg-carbon-raised p-5 sm:p-6">
      <fieldset disabled={guardando} className="grid gap-5">
        <label className="flex items-center gap-3 text-sm font-semibold"><input type="checkbox" checked={form.activo} onChange={(e) => setForm({ ...form, activo: e.target.checked })} className="h-5 w-5 accent-ember" />{form.activo ? "Juego activo en la tienda" : "Juego pausado"}</label>
        <div className="grid gap-3 sm:grid-cols-3">
          {premios.map(([campo, nombre]) => <label key={campo} className="text-sm" htmlFor={`juego-${campo}`}>{nombre}
            <input id={`juego-${campo}`} type="number" min={0} max={1000} required value={form[campo]} onChange={(e) => setForm({ ...form, [campo]: Math.max(0, Number(e.target.value)) })} className={`${control} mt-2 w-full`} />
            <span className="mt-1 block text-xs text-bone-dim">{total ? `${Math.round(form[campo] / total * 100)} % de las jugadas` : "Sin probabilidad"}</span>
          </label>)}
        </div>
        <label className="max-w-xs text-sm" htmlFor="juego-dias">Días para usar el premio
          <input id="juego-dias" type="number" min={1} max={90} required value={form.dias_validez} onChange={(e) => setForm({ ...form, dias_validez: Number(e.target.value) })} className={`${control} mt-2 w-full`} />
        </label>
        {mensaje && <p role="status" className="rounded-lg border border-signal/40 p-3 text-sm text-signal">{mensaje}</p>}
        {error && <p role="alert" className="rounded-lg border border-ember/40 p-3 text-sm text-ember">{error}</p>}
        <button type="submit" className="w-fit rounded-lg bg-ember px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{guardando ? "Guardando…" : "Guardar configuración"}</button>
      </fieldset>
    </form>
    <section className="mt-5 rounded-xl border border-carbon-line bg-carbon-raised p-5">
      <h3 className="text-sm font-semibold">Últimos premios</h3>
      {datos.premios.length === 0 ? <p className="mt-3 text-sm text-bone-dim">Todavía nadie jugó.</p> :
        <ul className="mt-3 divide-y divide-carbon-line text-sm">{datos.premios.map((p, i) => <li key={i} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5">
          <span className="min-w-0 break-all">{p.usuario}<span className="ml-2 text-xs text-bone-dim">{fecha(p.creado)} · vence {fecha(p.vence)}</span></span>
          <span className="flex items-center gap-3"><strong>{p.premio}</strong><span className={`rounded-md border px-2 py-0.5 text-xs ${p.estado === "Disponible" ? "border-signal/40 text-signal" : "border-carbon-line text-bone-dim"}`}>{p.estado}{p.pedido ? ` · #${p.pedido}` : ""}</span></span>
        </li>)}</ul>}
    </section>
  </section>;
}
