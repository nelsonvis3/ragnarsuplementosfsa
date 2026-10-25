"use client";

import { Suspense, useState, useSyncExternalStore } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Eye, EyeOff, Gift, LockKeyhole, Mail, Store } from "lucide-react";
import { registrarUsuario, iniciarSesion, ApiError, type RegistroResponse } from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import Logo from "@/components/Logo";
import { ReenviarConfirmacion } from "@/components/ConfirmacionEmail";

type Modo = "login" | "registro";
const observarHidratacion = () => () => {};
const clienteListo = () => true;
const servidorListo = () => false;

function LoginContent() {
  const listo = useSyncExternalStore(observarHidratacion, clienteListo, servidorListo);
  const router = useRouter();
  const searchParams = useSearchParams();
  const guardarSesion = useAuthStore((state) => state.iniciarSesion);
  const [modoElegido, setModoElegido] = useState<Modo | null>(null);
  const modo: Modo = modoElegido ?? (searchParams.get("modo") === "registro" ? "registro" : "login");
  const [nombreCompleto, setNombreCompleto] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [password2, setPassword2] = useState("");
  const [mostrarPassword, setMostrarPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);
  const [registroPendiente, setRegistroPendiente] = useState<RegistroResponse | null>(null);

  function cambiarModo(nuevo: Modo) {
    setModoElegido(nuevo);
    setError(null);
    setRegistroPendiente(null);
    setPassword("");
    setPassword2("");
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    if (modo === "registro" && password !== password2) {
      setError("Las contraseñas no coinciden.");
      return;
    }
    setCargando(true);
    try {
      if (modo === "registro") {
        const respuesta = await registrarUsuario(nombreCompleto.trim(), email.trim(), password);
        setRegistroPendiente(respuesta);
        setPassword("");
        setPassword2("");
        return;
      }
      const respuesta = await iniciarSesion(email.trim(), password);
      guardarSesion(respuesta.token, respuesta.usuario);
      const destino = searchParams.get("next");
      router.replace(respuesta.usuario.puede_administrar_catalogo ? "/administracion" : destino === "/carrito" ? "/carrito" : "/");
    } catch (err) {
      setError(err instanceof ApiError ? err.mensaje : "No pudimos conectar con el servidor.");
    } finally {
      setCargando(false);
    }
  }

  const input = "mt-2 w-full rounded-lg border border-carbon-line bg-carbon px-4 py-3 text-sm text-bone outline-none transition-colors focus:border-ember";
  return (
    <main className="relative flex min-h-screen flex-1 flex-col px-5 pb-14 pt-6 sm:px-8">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-bone-dim transition-colors hover:text-bone">
          <ArrowLeft size={17} /> Volver a la tienda
        </Link>
        <Link href="/" aria-label="Ir al inicio de Ragnar Suplementos" className="inline-flex items-center gap-2">
          <Logo width={36} height={59} className="h-8 w-auto" />
          <span className="font-display text-xl font-bold tracking-tight">RAGNAR</span>
        </Link>
      </div>

      <div className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-12 py-10 lg:grid-cols-[1fr_440px] lg:gap-20">
        <div className="hidden lg:block">
          <span className="forge-eyebrow">RAGNAR / CUENTA</span>
          <h1 className="forge-title mt-5 text-[clamp(3rem,5.2vw,5.6rem)] uppercase leading-[.95]">
            TU PRÓXIMO<br/><span className="text-ember">OBJETIVO</span><br/>EMPIEZA ACÁ.
          </h1>
          <p className="mt-7 max-w-sm text-sm leading-7 text-bone-dim">
            Ingresá para terminar tu compra. Tus productos quedan guardados en el carrito.
          </p>
          <div className="mt-10 space-y-4 text-sm text-bone-dim">
            <p className="flex items-center gap-3"><Gift size={19} className="text-ember" aria-hidden="true"/> Al crear tu cuenta das vuelta 3 cartas: 5 %, 10 % o envío gratis</p>
            <p className="flex items-center gap-3"><Store size={19} className="text-ember" aria-hidden="true"/> Retirás en Azcuénaga 991 o te lo enviamos en Formosa Capital</p>
          </div>
        </div>

        <section className="rounded-2xl border border-carbon-line bg-carbon-raised p-6 shadow-[0_25px_70px_rgba(0,0,0,.18)] sm:p-9" aria-label="Acceso a la cuenta">
          <span className="forge-eyebrow">MI CUENTA</span>
          <h2 className="mt-3 font-display text-3xl font-bold uppercase tracking-[-.035em]">
            {registroPendiente ? "Revisá tu correo" : modo === "login" ? "Bienvenido de nuevo" : "Creá tu cuenta"}
          </h2>
          <p className="mt-2 text-sm leading-6 text-bone-dim">
            {registroPendiente ? "Activá tu cuenta antes de iniciar sesión." : modo === "login" ? "Ingresá tus datos para continuar." : "Registrate para poder confirmar tus compras."}
          </p>

          {!registroPendiente && (
            <div className="mt-6 grid grid-cols-2 gap-2 rounded-xl bg-carbon p-1" role="group" aria-label="Tipo de acceso">
              <button type="button" onClick={() => cambiarModo("login")} aria-pressed={modo === "login"} className={`rounded-lg px-3 py-3 text-sm font-semibold transition-colors ${modo === "login" ? "bg-ember text-white" : "text-bone-dim hover:text-bone"}`}>Iniciar sesión</button>
              <button type="button" onClick={() => cambiarModo("registro")} aria-pressed={modo === "registro"} className={`rounded-lg px-3 py-3 text-sm font-semibold transition-colors ${modo === "registro" ? "bg-ember text-white" : "text-bone-dim hover:text-bone"}`}>Registrarse</button>
            </div>
          )}
          {error && <p role="alert" className="mt-5 rounded-lg border border-ember/40 bg-ember/10 p-3 text-sm text-ember">{error}</p>}

          {registroPendiente ? (
            <div className="mt-6">
              <div className="flex items-center gap-3 rounded-lg border border-carbon-line bg-carbon p-4">
                <Mail size={22} className="shrink-0 text-ember"/>
                <div><p className="text-sm leading-6">{registroPendiente.detail}</p><p className="mt-1 break-all text-xs font-semibold text-ember">{registroPendiente.email}</p></div>
              </div>
              <ReenviarConfirmacion emailInicial={registroPendiente.email} />
              <button type="button" onClick={() => cambiarModo("login")} className="mt-6 w-full text-sm font-semibold text-bone-dim hover:text-ember">Ya confirmé mi email · Iniciar sesión</button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {modo === "registro" && (
                <div>
                  <label htmlFor="nombre" className="text-sm font-semibold">Nombre completo</label>
                  <input id="nombre" type="text" required autoComplete="name" maxLength={150} value={nombreCompleto} onChange={e => setNombreCompleto(e.target.value)} className={input} />
                </div>
              )}
              <div>
                <label htmlFor="email" className="text-sm font-semibold">Email</label>
                <input id="email" type={modo === "registro" ? "email" : "text"} required autoComplete={modo === "registro" ? "email" : "username"} maxLength={254} value={email} onChange={e => setEmail(e.target.value)} className={input} />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <label htmlFor="password" className="text-sm font-semibold">Contraseña</label>
                  {modo === "login" && <Link href="/recuperar-contrasena" className="text-xs font-medium text-ember hover:underline">¿La olvidaste?</Link>}
                </div>
                <div className="relative">
                  <input id="password" type={mostrarPassword ? "text" : "password"} required minLength={modo === "registro" ? 8 : undefined} maxLength={modo === "registro" ? 128 : undefined} autoComplete={modo === "registro" ? "new-password" : "current-password"} value={password} onChange={e => setPassword(e.target.value)} className={input + " pr-12"} />
                  <button type="button" onClick={() => setMostrarPassword(!mostrarPassword)} aria-label={mostrarPassword ? "Ocultar contraseña" : "Mostrar contraseña"} className="absolute bottom-3.5 right-4 text-bone-dim hover:text-bone">
                    {mostrarPassword ? <EyeOff size={18}/> : <Eye size={18}/>}
                  </button>
                </div>
              </div>
              {modo === "registro" && (
                <div>
                  <label htmlFor="password2" className="text-sm font-semibold">Confirmar contraseña</label>
                  <input id="password2" type="password" required minLength={8} maxLength={128} autoComplete="new-password" value={password2} onChange={e => setPassword2(e.target.value)} className={input} />
                  <p className="mt-2 flex items-start gap-2 text-xs leading-5 text-bone-dim"><LockKeyhole size={14} className="mt-0.5 shrink-0"/> Usá al menos ocho caracteres y una contraseña que no sea común.</p>
                </div>
              )}
              <button type="submit" disabled={!listo || cargando} className="mt-2 w-full rounded-lg bg-ember px-6 py-3.5 text-sm font-bold uppercase tracking-wide text-white hover:bg-ember-bright disabled:opacity-60">
                {cargando ? "Un momento…" : modo === "login" ? "Iniciar sesión" : "Crear cuenta"}
              </button>
              {modo === "login" && <Link href="/confirmar-email" className="block pt-2 text-center text-xs font-semibold text-bone-dim hover:text-ember">¿No recibiste la confirmación de email?</Link>}
            </form>
          )}
        </section>
      </div>
      <p className="text-center text-xs text-bone-dim">Ragnar Suplementos · Acceso seguro a tu cuenta</p>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<main className="flex flex-1 items-center justify-center px-5 py-16 text-sm text-bone-dim">Preparando acceso…</main>}>
      <LoginContent />
    </Suspense>
  );
}
