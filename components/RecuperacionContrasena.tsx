"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { ApiError, restablecerContrasena, solicitarRecuperacionContrasena } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
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

export default function RecuperacionContrasena({ restablecer = false }: { restablecer?: boolean }) {
  const listo = useSyncExternalStore(suscribirHidratacion, clienteListo, servidorListo);
  const fragmento = useSyncExternalStore(suscribirFragmento, fragmentoCliente, fragmentoServidor);
  const usuario = useAuthStore((state) => state.usuario);
  const sesionVerificada = useAuthStore((state) => state.sesionVerificada);
  const cerrarSesion = useAuthStore((state) => state.cerrarSesion);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmacion, setConfirmacion] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const parametros = new URLSearchParams(fragmento.slice(1));
  const uid = parametros.get("uid") ?? "";
  const token = parametros.get("token") ?? "";
  const cuentaAdministrativa = sesionVerificada && usuario && !usuario.puede_recuperar_contrasena;
  const enlaceIncompleto = restablecer && listo && (!uid || !token);

  useEffect(() => {
    if (!restablecer) return;
    // Un enlace de correo puede abrirse en la misma pestaña sin recargar la página.
    function reiniciarFormulario() {
      setMensaje("");
      setError("");
      setPassword("");
      setConfirmacion("");
    }
    window.addEventListener("hashchange", reiniciarFormulario);
    return () => window.removeEventListener("hashchange", reiniciarFormulario);
  }, [restablecer]);

  async function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (restablecer && password !== confirmacion) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setCargando(true);
    try {
      const respuesta = restablecer
        ? await restablecerContrasena(uid, token, password, confirmacion)
        : await solicitarRecuperacionContrasena(email);
      if (restablecer && window.location.hash !== fragmento) return;
      setMensaje(respuesta.detail);
      if (restablecer) {
        setPassword("");
        setConfirmacion("");
        cerrarSesion();
        window.history.replaceState(null, "", window.location.pathname);
      }
    } catch (err) {
      if (restablecer && window.location.hash !== fragmento) return;
      setError(err instanceof ApiError && err.status ? err.mensaje : "No pudimos conectar con el servidor. Intentá nuevamente.");
    } finally {
      setCargando(false);
    }
  }

  const claseInput = "mt-1 w-full border border-carbon-line bg-carbon px-3 py-2 text-sm outline-none focus:border-ember";

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="w-full max-w-md border border-carbon-line bg-carbon-raised p-6 sm:p-8">
        <div className="flex justify-center"><Logo width={36} height={59} className="h-10 w-auto" /></div>
        <h1 className="mt-6 font-display text-2xl font-semibold">{restablecer ? "Nueva contraseña" : "Recuperar contraseña"}</h1>
        {cuentaAdministrativa ? (
          <p className="mt-4 text-sm text-bone-dim">La recuperación por correo está disponible para clientes. La contraseña de una cuenta administrativa se cambia desde Django.</p>
        ) : mensaje ? (
          <p role="status" className="mt-4 border border-carbon-line p-4 text-sm leading-relaxed">{mensaje}</p>
        ) : enlaceIncompleto ? (
          <p role="alert" className="mt-4 text-sm text-ember">El enlace está incompleto. Solicitá uno nuevo para recuperar tu contraseña.</p>
        ) : (
          <>
            <p className="mt-3 text-sm leading-relaxed text-bone-dim">
              {restablecer ? "Elegí una contraseña de al menos 8 caracteres. Evitá claves comunes o compuestas solo por números." : "Ingresá el email de tu cuenta y te enviaremos un enlace para elegir una nueva contraseña."}
            </p>
            {error && <p role="alert" className="mt-4 border border-ember/40 bg-ember/10 p-3 text-sm text-ember">{error}</p>}
            <form method="post" onSubmit={enviar} className="mt-6 flex flex-col gap-4">
              {restablecer ? (
                <>
                  <div>
                    <label htmlFor="nueva-password" className="text-sm font-medium">Nueva contraseña</label>
                    <input id="nueva-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password} onChange={(event) => setPassword(event.target.value)} className={claseInput} />
                  </div>
                  <div>
                    <label htmlFor="confirmar-password" className="text-sm font-medium">Repetir contraseña</label>
                    <input id="confirmar-password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={confirmacion} onChange={(event) => setConfirmacion(event.target.value)} className={claseInput} />
                  </div>
                </>
              ) : (
                <div>
                  <label htmlFor="recuperar-email" className="text-sm font-medium">Email</label>
                  <input id="recuperar-email" type="email" autoComplete="email" maxLength={254} required value={email} onChange={(event) => setEmail(event.target.value)} className={claseInput} />
                </div>
              )}
              <button type="submit" disabled={!listo || cargando} className="mt-2 bg-ember px-4 py-3 text-sm font-semibold uppercase tracking-wide text-carbon transition-colors hover:bg-ember-bright disabled:cursor-not-allowed disabled:opacity-60">
                {cargando ? "Un momento..." : restablecer ? "Guardar contraseña" : "Enviar enlace"}
              </button>
            </form>
          </>
        )}
        {!cuentaAdministrativa && restablecer && (enlaceIncompleto || error) && (
          <p className="mt-4 text-center text-sm"><Link href="/recuperar-contrasena" className="text-ember hover:underline">Solicitar un nuevo enlace</Link></p>
        )}
        <p className="mt-6 text-center text-sm text-bone-dim"><Link href="/login" className="hover:text-ember">Volver a iniciar sesión</Link></p>
      </div>
    </main>
  );
}
