"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registrarUsuario, iniciarSesion, ApiError, type RegistroResponse } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import Logo from "@/components/Logo";
import { ReenviarConfirmacion } from "@/components/ConfirmacionEmail";

type Modo = "login" | "registro";
const observarHidratacion = () => () => {};
const clienteListo = () => true;
const servidorListo = () => false;

export default function LoginPage() {
  const listo = useSyncExternalStore(observarHidratacion, clienteListo, servidorListo);
  const router = useRouter();
  const guardarSesion = useAuthStore((state) => state.iniciarSesion);
  const usuario = useAuthStore((state) => state.usuario);
  const sesionVerificada = useAuthStore((state) => state.sesionVerificada);

  const [modo, setModo] = useState<Modo>("login");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [registroPendiente, setRegistroPendiente] = useState<RegistroResponse | null>(null);

  function limpiarError() {
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (modo === "registro" && password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }

    setCargando(true);

    try {
      if (modo === "registro") {
        setRegistroPendiente(await registrarUsuario(nombreCompleto, email, password));
        setPassword("");
        setPassword2("");
        return;
      }
      const respuesta = await iniciarSesion(email, password);

      guardarSesion(respuesta.token, respuesta.usuario);
      router.push(respuesta.usuario.puede_administrar_catalogo ? "/administracion" : "/");
    } catch (err) {
      const mensaje =
        err instanceof ApiError ? err.mensaje : "No pudimos conectar con el servidor.";
      setError(mensaje);
    } finally {
      setCargando(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16">
      <div className="w-full max-w-sm border border-carbon-line bg-carbon-raised p-8">
        <div className="flex justify-center">
          <Logo width={36} height={59} className="h-10 w-auto" />
        </div>

        <div className="mt-6 flex border border-carbon-line">
          <button
            onClick={() => {
              setModo("login");
              setRegistroPendiente(null);
              limpiarError();
            }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              modo === "login"
                ? "bg-ember text-carbon"
                : "text-bone-dim hover:text-bone"
            }`}
          >
            Iniciar sesión
          </button>
          <button
            onClick={() => {
              setModo("registro");
              setRegistroPendiente(null);
              limpiarError();
            }}
            className={`flex-1 py-2 text-sm font-medium transition-colors ${
              modo === "registro"
                ? "bg-ember text-carbon"
                : "text-bone-dim hover:text-bone"
            }`}
          >
            Registrarse
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-4 border border-ember/40 bg-ember/10 p-3 text-sm text-ember">
            {error}
          </p>
        )}

        {registroPendiente ? (
          <div className="mt-6">
            <h1 className="font-display text-xl font-semibold">Revisá tu correo</h1>
            <p role="status" className="mt-3 text-sm leading-6">{registroPendiente.detail}</p>
            <p className="mt-2 break-all text-sm text-ember">{registroPendiente.email}</p>
            <ReenviarConfirmacion emailInicial={registroPendiente.email} />
          </div>
        ) : <form method="post" onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          {modo === "registro" && (
            <div>
              <label className="text-sm font-medium" htmlFor="nombre">
                Nombre completo
              </label>
              <input
                id="nombre"
                type="text"
                autoComplete="name"
                maxLength={150}
                required
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                className="mt-1 w-full border border-carbon-line bg-carbon px-3 py-2 text-sm outline-none focus:border-ember"
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium" htmlFor="email">
              {modo === "login" ? "Usuario o email" : "Email"}
            </label>
            <input
              id="email"
              type={modo === "login" ? "text" : "email"}
              autoComplete={modo === "login" ? "username" : "email"}
              maxLength={254}
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 w-full border border-carbon-line bg-carbon px-3 py-2 text-sm outline-none focus:border-ember"
            />
          </div>

          <div>
            <label className="text-sm font-medium" htmlFor="password">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={modo === "registro" ? 8 : undefined}
              maxLength={modo === "registro" ? 128 : undefined}
              autoComplete={modo === "registro" ? "new-password" : "current-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full border border-carbon-line bg-carbon px-3 py-2 text-sm outline-none focus:border-ember"
            />
          </div>

          {modo === "registro" && (
            <div>
              <label className="text-sm font-medium" htmlFor="password2">
                Repetir contraseña
              </label>
              <input
                id="password2"
                type="password"
                required
                minLength={8}
                value={password2}
                onChange={(e) => setPassword2(e.target.value)}
                className="mt-1 w-full border border-carbon-line bg-carbon px-3 py-2 text-sm outline-none focus:border-ember"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={!listo || cargando}
            className="mt-2 bg-ember px-6 py-3 text-sm font-semibold uppercase tracking-wide text-carbon transition-colors hover:bg-ember-bright disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cargando
              ? "Un momento..."
              : modo === "login"
                ? "Iniciar sesión"
                : "Crear cuenta"}
          </button>
        </form>}

        {modo === "login" && !(sesionVerificada && usuario && !usuario.puede_recuperar_contrasena) && (
          <p className="mt-4 text-center text-sm text-bone-dim">
            <Link href="/recuperar-contrasena" className="hover:text-ember">Olvidé mi contraseña</Link>
            <Link href="/confirmar-email" className="mt-3 block text-xs hover:text-ember">Reenviar confirmación de e-mail</Link>
          </p>
        )}

        <p className="mt-6 text-center text-xs text-bone-dim">
          <Link href="/" className="hover:text-ember">
            Volver al inicio
          </Link>
        </p>
      </div>
    </main>
  );
}
