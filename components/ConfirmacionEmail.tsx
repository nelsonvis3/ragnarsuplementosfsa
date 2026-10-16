"use client";

import { useEffect, useId, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ApiError, confirmarEmail, reenviarConfirmacionEmail } from "@/lib/api";
import Logo from "@/components/Logo";

const suscribirHidratacion = () => () => {};
const clienteListo = () => true;
const servidorListo = () => false;
const fragmentoCliente = () => window.location.hash;
const fragmentoServidor = () => "";
function suscribirFragmento(callback: () => void) {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
function mensajeError(error: unknown) {
  return error instanceof ApiError && error.status ? error.mensaje : "No pudimos conectar con el servidor. Intentá nuevamente.";
}

export function ReenviarConfirmacion({ emailInicial = "" }: { emailInicial?: string }) {
  const listo = useSyncExternalStore(suscribirHidratacion, clienteListo, servidorListo);
  const id = useId();
  const [email, setEmail] = useState(emailInicial);
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  async function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMensaje("");
    setCargando(true);
    try { setMensaje((await reenviarConfirmacionEmail(email)).detail); }
    catch (err) { setError(mensajeError(err)); }
    finally { setCargando(false); }
  }

  return (
    <form method="post" onSubmit={enviar} className="mt-6 space-y-4">
      <div>
        <label htmlFor={id} className="text-sm font-medium">Email de tu cuenta</label>
        <input id={id} type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} className="mt-2 w-full border border-carbon-line bg-carbon px-3 py-2.5 text-sm outline-none focus:border-ember" />
      </div>
      <p className="text-xs leading-5 text-bone-dim">Revisá el correo no deseado. Esperá un minuto entre solicitudes.</p>
      {mensaje && <p role="status" className="border border-carbon-line p-3 text-sm leading-6">{mensaje}</p>}
      {error && <p role="alert" className="text-sm text-ember">{error}</p>}
      <button type="submit" disabled={!listo || cargando} className="w-full border border-ember px-4 py-3 text-sm font-semibold text-ember transition-colors hover:bg-ember/10 disabled:opacity-60">{cargando ? "Enviando…" : "Reenviar confirmación"}</button>
    </form>
  );
}

export default function ConfirmacionEmail() {
  const listo = useSyncExternalStore(suscribirHidratacion, clienteListo, servidorListo);
  const fragmento = useSyncExternalStore(suscribirFragmento, fragmentoCliente, fragmentoServidor);
  const token = new URLSearchParams(fragmento.slice(1)).get("token") ?? "";
  const [confirmado, setConfirmado] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    function limpiar() { setConfirmado(""); setError(""); }
    window.addEventListener("hashchange", limpiar);
    return () => window.removeEventListener("hashchange", limpiar);
  }, []);

  async function confirmar() {
    setCargando(true);
    setError("");
    try {
      const respuesta = await confirmarEmail(token);
      if (window.location.hash !== fragmento) return;
      setConfirmado(respuesta.detail);
      window.history.replaceState(null, "", window.location.pathname);
    } catch (err) {
      if (window.location.hash === fragmento) setError(mensajeError(err));
    } finally { setCargando(false); }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="w-full max-w-md border border-carbon-line bg-carbon-raised p-6 sm:p-8">
        <div className="flex justify-center"><Logo width={36} height={59} className="h-10 w-auto" /></div>
        <h1 className="mt-6 font-display text-2xl font-semibold">{confirmado ? "¡Tu email está confirmado!" : token ? "Confirmá tu e-mail" : "Reenviar confirmación"}</h1>
        {confirmado ? (
          <p role="status" className="mt-4 border border-carbon-line p-4 text-sm leading-6">{confirmado}</p>
        ) : (
          <>
            <p className="mt-3 text-sm leading-6 text-bone-dim">{token ? "Estás a un paso de desbloquear tu potencial. Confirmá tu email para activar tu cuenta en Ragnar." : "Ingresá el email con el que te registraste para recibir un nuevo enlace de confirmación."}</p>
            {error && <p role="alert" className="mt-4 border border-ember/40 bg-ember/10 p-3 text-sm text-ember">{error}</p>}
            {token && <button type="button" disabled={!listo || cargando} onClick={confirmar} className="mt-6 w-full bg-ember px-4 py-3 text-sm font-semibold text-carbon hover:bg-ember-bright disabled:opacity-60">{cargando ? "Confirmando…" : "Confirmar e-mail"}</button>}
            {listo && (!token || error) && <ReenviarConfirmacion />}
          </>
        )}
        <p className="mt-6 text-center text-sm text-bone-dim"><Link href="/login" className="hover:text-ember">{confirmado ? "Iniciar sesión" : "Volver a iniciar sesión"}</Link></p>
      </div>
    </main>
  );
}
