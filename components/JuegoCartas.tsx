"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { jugarJuego, obtenerJuego, type PremioJuego } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";

const VISTO = "ragnar_juego_visto";
const CARTAS = 6;
const A_DAR_VUELTA = 3;

/** One draw per account, decided by the server. The three flipped cards reveal that prize; nothing else is shown. */
export default function JuegoCartas() {
  const token = useAuthStore((s) => s.token);
  const usuario = useAuthStore((s) => s.usuario);
  const sesionVerificada = useAuthStore((s) => s.sesionVerificada);
  const [abierto, setAbierto] = useState(false);
  const [premio, setPremio] = useState<PremioJuego | null>(null);
  const [volteadas, setVolteadas] = useState<number[]>([]);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const logueado = Boolean(token && usuario && sesionVerificada);

  useEffect(() => {
    if (token && !sesionVerificada) return;
    // "1": closed for good. "login": guest went to sign in, so show it once they are back with a session.
    try { const visto = localStorage.getItem(VISTO); if (visto === "1" || (visto === "login" && !logueado)) return; } catch { return; }
    let vigente = true;
    const espera = window.setTimeout(() => {
      obtenerJuego(logueado ? token : null).then((estado) => {
        if (vigente && estado.activo && (estado.puede_jugar || !logueado)) setAbierto(true);
      }).catch(() => {});
    }, 6000);
    return () => { vigente = false; window.clearTimeout(espera); };
  }, [token, sesionVerificada, logueado]);

  // Other parts of the store (cart, checkout) can open the game on demand.
  useEffect(() => {
    const abrir = () => setAbierto(true);
    window.addEventListener("ragnar:juego", abrir);
    return () => window.removeEventListener("ragnar:juego", abrir);
  }, []);

  useEffect(() => {
    if (!abierto) return;
    const cerrarConEsc = (e: KeyboardEvent) => { if (e.key === "Escape") cerrar(); };
    window.addEventListener("keydown", cerrarConEsc);
    return () => window.removeEventListener("keydown", cerrarConEsc);
  }, [abierto]);

  function cerrar() {
    setAbierto(false);
    try { localStorage.setItem(VISTO, "1"); } catch { /* storage disabled */ }
  }

  async function darVuelta(indice: number) {
    if (!logueado || !token || volteadas.includes(indice) || volteadas.length >= A_DAR_VUELTA || cargando) return;
    setError("");
    if (!premio) {
      setCargando(true);
      try { setPremio((await jugarJuego(token)).premio); }
      catch (e) { setError(e instanceof Error ? e.message : "No pudimos sortear tu premio. Probá de nuevo."); setCargando(false); return; }
      setCargando(false);
    }
    setVolteadas((v) => [...v, indice]);
  }

  if (!abierto) return null;
  const terminado = premio && volteadas.length >= A_DAR_VUELTA;
  const vence = premio ? new Date(premio.vence).toLocaleDateString("es-AR", { day: "numeric", month: "long" }) : "";

  return <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/75 p-4" role="dialog" aria-modal="true" aria-labelledby="juego-titulo" onClick={(e) => { if (e.target === e.currentTarget) cerrar(); }}>
    <div className="relative w-full max-w-[560px] overflow-hidden rounded-xl border border-carbon-line bg-carbon-raised p-6 shadow-[0_30px_90px_rgba(0,0,0,.55)] sm:p-8">
      <button type="button" onClick={cerrar} aria-label="Cerrar el juego" className="absolute right-3 top-3 p-2 text-bone-dim hover:text-bone"><X size={20} /></button>
      <p className="text-[11px] font-bold uppercase tracking-[.18em] text-ember">Juego de cartas Ragnar</p>
      <h2 id="juego-titulo" className="mt-2 font-display text-3xl font-extrabold uppercase tracking-[-.03em] sm:text-4xl">{terminado ? "¡Ganaste!" : "Probá tu suerte"}</h2>
      <p className="mt-2 text-sm leading-6 text-bone-dim">{terminado
        ? `${premio!.descripcion} para tu próxima compra. Lo activás en el carrito, hasta el ${vence}. Cada compra confirmada de 5 productos o más te da otra jugada.`
        : logueado ? `Da vuelta ${A_DAR_VUELTA} cartas y descubrí tu premio: 5%, 10% de descuento o envío gratis. Todos ganan.`
          : "Creá tu cuenta e iniciá sesión para jugar: todos ganan 5%, 10% o envío gratis. Y sumás otra jugada con cada compra de 5 productos o más."}</p>

      <div className="mt-6 grid grid-cols-3 gap-3" aria-live="polite">
        {Array.from({ length: CARTAS }, (_, i) => {
          const visible = volteadas.includes(i) && premio;
          return <button key={i} type="button" disabled={!logueado || Boolean(visible) || Boolean(terminado) || cargando} onClick={() => void darVuelta(i)}
            aria-label={visible ? `Carta ${i + 1}: ${premio!.descripcion}` : `Dar vuelta la carta ${i + 1}`}
            className={`juego-carta ${visible ? "is-volteada" : ""}`}>
            <span className="juego-cara juego-dorso"><Image src="/logo.png" alt="" width={34} height={56} className="h-12 w-auto opacity-90" /></span>
            <span className="juego-cara juego-frente">{premio ? (premio.tipo === "envio_gratis" ? <><b>Envío</b><small>gratis</small></> : <><b>{premio.porcentaje}%</b><small>OFF</small></>) : null}</span>
          </button>;
        })}
      </div>

      {error && <p role="alert" className="mt-4 rounded-md border border-ember/40 bg-ember/10 p-3 text-sm">{error}</p>}
      <div className="mt-6 flex flex-wrap gap-3">
        {!logueado ? <>
          <Link href="/login?next=/" onClick={() => { setAbierto(false); try { localStorage.setItem(VISTO, "login"); } catch { /* storage disabled */ } }} className="rounded-md bg-ember px-5 py-3 text-sm font-bold uppercase tracking-wide text-white">Ingresar y jugar</Link>
          <Link href="/login?modo=registro&next=/" onClick={() => { setAbierto(false); try { localStorage.setItem(VISTO, "login"); } catch { /* storage disabled */ } }} className="rounded-md border border-carbon-line px-5 py-3 text-sm font-bold uppercase tracking-wide hover:border-ember">Crear cuenta</Link>
        </> : terminado ? <Link href="/productos" onClick={cerrar} className="rounded-md bg-ember px-5 py-3 text-sm font-bold uppercase tracking-wide text-white">Usarlo en el catálogo</Link>
          : <p className="text-sm text-bone-dim">{volteadas.length}/{A_DAR_VUELTA} cartas</p>}
        <button type="button" onClick={cerrar} className="px-2 py-3 text-sm text-bone-dim underline underline-offset-4 hover:text-bone">{terminado ? "Cerrar" : "Ahora no"}</button>
      </div>
    </div>
  </div>;
}
