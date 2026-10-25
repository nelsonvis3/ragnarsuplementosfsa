"use client";

import { useEffect, useState, type FormEvent } from "react";
import { ApiError, guardarTienda, obtenerTienda, type ConfiguracionTienda } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const control = "min-h-11 w-full rounded-lg border border-carbon-line bg-carbon px-3 py-2 text-sm outline-none focus:border-ember";
const dinero = (n: number) => n === 0 ? "gratis" : n.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

/** "1:0,3:1000" → "Hasta 1 km: gratis · hasta 3 km: $ 1.000". Si no se entiende, lo valida el servidor al guardar. */
function leerTarifas(texto: string) {
  const tramos = texto.split(",").map((t) => t.split(":").map((v) => Number(v.trim())));
  if (!tramos.length || tramos.some((t) => t.length !== 2 || t.some((v) => !Number.isFinite(v)))) return "";
  return tramos.sort((a, b) => a[0] - b[0]).map(([km, precio], i) => `${i ? "hasta" : "Hasta"} ${km.toLocaleString("es-AR")} km: ${dinero(precio)}`).join(" · ") + ". Más lejos no se hacen envíos.";
}

const campos: { campo: keyof ConfiguracionTienda; titulo: string; ayuda?: string; largo?: boolean }[] = [
  { campo: "pago_titular", titulo: "Titular de la cuenta" },
  { campo: "pago_alias", titulo: "Alias" },
  { campo: "pago_cvu", titulo: "CVU", ayuda: "22 números." },
  { campo: "envio_tarifas", titulo: "Tarifas de envío", ayuda: "Hasta cuántos km y precio, separados por comas. Ej.: 1:0,3:1000,5:2500" },
  { campo: "instrucciones_local", titulo: "Mensaje para retiro y pago en el local", largo: true },
  { campo: "instrucciones_efectivo_envio", titulo: "Mensaje para pago en efectivo al recibir el envío", largo: true },
];

export default function TiendaPanel({ token }: { token: string }) {
  const cerrarSesion = useAuthStore((s) => s.cerrarSesion);
  const [form, setForm] = useState<ConfiguracionTienda | null>(null);
  const [vigente, setVigente] = useState<ConfiguracionTienda | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let vigente = true;
    obtenerTienda(token).then(({ vigente: v, ...datos }) => { if (vigente) { setForm(datos); setVigente(v); } }).catch((e: unknown) => {
      if (!vigente) return;
      if (e instanceof ApiError && e.status === 401) cerrarSesion(); else setError(e instanceof Error ? e.message : "No pudimos cargar la configuración.");
    });
    return () => { vigente = false; };
  }, [token, cerrarSesion]);

  async function guardar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form) return;
    setGuardando(true); setError(""); setMensaje("");
    try {
      const { vigente: v, ...datos } = await guardarTienda(token, form);
      setForm(datos); setVigente(v); setMensaje("Guardado. La tienda y los emails ya usan estos datos.");
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) cerrarSesion(); else setError(e instanceof Error ? e.message : "No pudimos guardar.");
    } finally { setGuardando(false); }
  }

  if (!form || !vigente) return <section><h2 className="font-display text-2xl font-semibold">Pagos y envíos</h2>{error ? <p role="alert" className="mt-5 text-sm text-ember">{error}</p> : <p role="status" className="mt-6 text-sm text-bone-dim">Cargando…</p>}</section>;

  return <section aria-labelledby="tienda-titulo">
    <h2 id="tienda-titulo" className="font-display text-2xl font-semibold">Pagos y envíos</h2>
    <p className="mt-2 max-w-2xl text-sm leading-6 text-bone-dim">Lo que ven los clientes al pagar por transferencia, el costo del envío según la distancia y los mensajes de los emails de pedido.</p>
    <form onSubmit={guardar} className="mt-6 rounded-xl border border-carbon-line bg-carbon-raised p-5 sm:p-6">
      <fieldset disabled={guardando} className="grid gap-5 sm:grid-cols-2">
        {campos.map(({ campo, titulo, ayuda, largo }) => <label key={campo} className={`text-sm ${largo || campo === "envio_tarifas" ? "sm:col-span-2" : ""}`} htmlFor={`tienda-${campo}`}>{titulo}
          {largo ? <textarea id={`tienda-${campo}`} rows={3} maxLength={500} value={form[campo]} placeholder={vigente[campo]} onChange={(e) => setForm({ ...form, [campo]: e.target.value })} className={`${control} mt-2`} />
            : <input id={`tienda-${campo}`} value={form[campo]} placeholder={vigente[campo]} maxLength={campo === "envio_tarifas" ? 300 : 150} onChange={(e) => setForm({ ...form, [campo]: e.target.value })} className={`${control} mt-2`} />}
          {ayuda && <span className="mt-1 block text-xs text-bone-dim">{ayuda}</span>}
          {campo === "envio_tarifas" && leerTarifas(form.envio_tarifas || vigente.envio_tarifas) && <span className="mt-1 block text-xs text-signal">{leerTarifas(form.envio_tarifas || vigente.envio_tarifas)}</span>}
        </label>)}
        <p className="text-xs leading-5 text-bone-dim sm:col-span-2">Si dejás un campo vacío se usa el valor de la configuración del servidor, que aparece en gris.</p>
        {mensaje && <p role="status" className="rounded-lg border border-signal/40 p-3 text-sm text-signal sm:col-span-2">{mensaje}</p>}
        {error && <p role="alert" className="rounded-lg border border-ember/40 p-3 text-sm text-ember sm:col-span-2">{error}</p>}
        <button type="submit" className="w-fit rounded-lg bg-ember px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{guardando ? "Guardando…" : "Guardar"}</button>
      </fieldset>
    </form>
  </section>;
}
