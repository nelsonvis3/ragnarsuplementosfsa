"use client";

import { useEffect, useId, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ApiError, confirmarEmail, reenviarConfirmacionEmail } from "@/lib/api";
import Logo from "@/components/Logo";
import { useAuthStore } from "@/store/auth-store";

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
  const [intento, setIntento] = useState(0);
  const guardarSesion = useAuthStore((state) => state.iniciarSesion);
  const peticion = useRef<{ token: string; intento: number; promesa: ReturnType<typeof confirmarEmail> } | null>(null);
  const cargando = Boolean(token && !confirmado && !error);

  useEffect(() => {
    function limpiar() { setConfirmado(""); setError(""); }
    window.addEventListener("hashchange", limpiar);
    return () => window.removeEventListener("hashchange", limpiar);
  }, []);

  useEffect(() => {
    if (!listo || !token) return;
    let vigente = true;
    // Reutilizar la promesa evita consumir dos veces el enlace en StrictMode.
    if (!peticion.current || peticion.current.token !== token || peticion.current.intento !== intento) {
      peticion.current = { token, intento, promesa: confirmarEmail(token) };
    }
    void peticion.current.promesa.then((respuesta) => {
      if (!vigente || window.location.hash !== fragmento) return;
      guardarSesion(respuesta.token, respuesta.usuario);
      window.history.replaceState(null, "", window.location.pathname);
      setConfirmado(respuesta.detail);
      peticion.current = null;
    }).catch((err: unknown) => {
      if (vigente && window.location.hash === fragmento) setError(mensajeError(err));
    });
    return () => { vigente = false; };
  }, [listo, token, fragmento, intento, guardarSesion]);

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="w-full max-w-md border border-carbon-line bg-carbon-raised p-6 sm:p-8">
        <div className="flex justify-center"><Logo width={36} height={59} className="h-10 w-auto" /></div>
        <h1 className="mt-6 font-display text-2xl font-semibold">{confirmado ? "¡Ya estás dentro!" : token ? "Activá tu cuenta" : "Reenviar confirmación"}</h1>
        {confirmado ? (
          <p role="status" className="mt-4 border border-carbon-line p-4 text-sm leading-6">{confirmado}</p>
        ) : (
          <>
            <p className="mt-3 text-sm leading-6 text-bone-dim">{token ? "Estamos confirmando tu email e iniciando tu sesión en Ragnar." : "Ingresá el email con el que te registraste para recibir un nuevo enlace de confirmación."}</p>
            {error && <p role="alert" className="mt-4 border border-ember/40 bg-ember/10 p-3 text-sm text-ember">{error}</p>}
            {cargando && <p role="status" className="mt-6 text-sm text-bone-dim">Confirmando tu cuenta…</p>}
            {token && error && <button type="button" onClick={() => { setError(""); setIntento((valor) => valor + 1); }} className="mt-6 w-full bg-ember px-4 py-3 text-sm font-semibold text-white hover:bg-ember-bright">Reintentar confirmación</button>}
            {listo && (!token || error) && <ReenviarConfirmacion />}
          </>
        )}
        <p className="mt-6 text-center text-sm text-bone-dim"><Link href={confirmado ? "/productos" : "/login"} className="hover:text-ember">{confirmado ? "Explorar suplementos" : "Volver a iniciar sesión"}</Link></p>
      </div>
    </main>
  );
}
