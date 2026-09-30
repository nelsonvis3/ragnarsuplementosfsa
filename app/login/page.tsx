"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { registrarUsuario, iniciarSesion, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import Logo from "@/components/Logo";

type Modo = "login" | "registro";

export default function LoginPage() {
  const router = useRouter();
  const guardarSesion = useAuthStore((state) => state.iniciarSesion);

  const [modo, setModo] = useState<Modo>("login");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

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
      const respuesta =
        modo === "login"
          ? await iniciarSesion(email, password)
          : await registrarUsuario(nombreCompleto, email, password);

      guardarSesion(respuesta.token, respuesta.usuario);
      router.push("/");
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
          <p className="mt-4 border border-ember/40 bg-ember/10 p-3 text-sm text-ember">
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
          {modo === "registro" && (
            <div>
              <label className="text-sm font-medium" htmlFor="nombre">
                Nombre completo
              </label>
              <input
                id="nombre"
                type="text"
                required
                value={nombreCompleto}
                onChange={(e) => setNombreCompleto(e.target.value)}
                className="mt-1 w-full border border-carbon-line bg-carbon px-3 py-2 text-sm outline-none focus:border-ember"
              />
            </div>
          )}

          <div>
            <label className="text-sm font-medium" htmlFor="email">
              Email
            </label>
            <input
              id="email"
              type="email"
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
                minLength={8}
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
            disabled={cargando}
            className="mt-2 bg-ember px-6 py-3 text-sm font-semibold uppercase tracking-wide text-carbon transition-colors hover:bg-ember-bright disabled:cursor-not-allowed disabled:opacity-60"
          >
            {cargando
              ? "Un momento..."
              : modo === "login"
                ? "Iniciar sesión"
                : "Crear cuenta"}
          </button>
        </form>

        <p className="mt-6 text-center text-xs text-bone-dim">
          <Link href="/" className="hover:text-ember">
            Volver al inicio
          </Link>
        </p>
      </div>
    </main>
  );
}
