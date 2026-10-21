"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { enviarSolicitudAtencion } from "@/lib/api";

export default function ForgeAsesoramiento() {
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [solicitudId, setSolicitudId] = useState<number | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (enviando) return;
    setError("");

    const nombreFinal = nombre.trim();
    const emailFinal = email.trim();
    const mensajeFinal = mensaje.trim();

    if (!nombreFinal || !emailFinal || !mensajeFinal) {
      setError("Completá los tres campos antes de enviar tu consulta.");
      return;
    }

    setEnviando(true);
    try {
      const resultado = await enviarSolicitudAtencion({
        tipo: "consulta",
        nombre: nombreFinal,
        email: emailFinal,
        mensaje: mensajeFinal,
      });
      setSolicitudId(resultado.id);
      setNombre("");
      setEmail("");
      setMensaje("");
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "No pudimos registrar tu consulta. Volvé a intentarlo.",
      );
    } finally {
      setEnviando(false);
    }
  }

  const campo = "mt-2 w-full rounded-xl border border-carbon-line bg-carbon px-4 py-3.5 text-sm text-bone outline-none transition-colors placeholder:text-bone-dim/70 focus:border-ember";

  return (
    <section
      id="asesoramiento"
      aria-labelledby="asesoramiento-titulo"
      className="scroll-mt-28 border-t border-carbon-line bg-carbon-raised/40"
    >
      <div className="mx-auto grid max-w-7xl gap-12 px-5 py-16 sm:px-8 sm:py-24 lg:grid-cols-[.9fr_1.1fr] lg:items-center lg:gap-20">
        <div>
          <span className="forge-eyebrow">HABLEMOS DE TU PRÓXIMO OBJETIVO</span>
          <h2
            id="asesoramiento-titulo"
            className="forge-title mt-5 max-w-[13ch] text-5xl uppercase sm:text-6xl lg:text-7xl"
          >
            ¿QUERÉS QUE TE <span className="text-ember">ASESOREMOS?</span>
          </h2>
          <p className="mt-7 max-w-md text-base leading-8 text-bone-dim">
            Contanos qué estás buscando o qué dudas tenés sobre nuestros
            suplementos. Dejanos tu consulta y te ayudamos a encontrar
            una opción para vos.
          </p>
          <div className="mt-9 h-[3px] w-16 bg-ember" aria-hidden="true" />
          <p className="mt-5 max-w-sm text-sm leading-7 text-bone-dim">
            Si preferís conversar directamente, también podés
            {" "}
            <a
              href="https://wa.me/5493704696533"
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-bone underline decoration-ember underline-offset-4 hover:text-ember"
            >
              escribirnos por WhatsApp
            </a>.
          </p>
        </div>

        <div className="relative overflow-hidden rounded-2xl border border-carbon-line bg-carbon-raised p-6 shadow-[0_24px_64px_rgba(0,0,0,.12)] sm:p-9">
          <div className="absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r from-ember via-ember-bright to-transparent" aria-hidden="true" />

          {solicitudId !== null ? (
            <div role="status" aria-live="polite" className="py-6">
              <span className="forge-eyebrow">CONSULTA ENVIADA</span>
              <h3 className="mt-4 font-display text-4xl font-extrabold">
                RECIBIMOS TU MENSAJE.
              </h3>
              <p className="mt-4 text-sm leading-7 text-bone-dim">
                Registramos tu consulta correctamente. Guardá el número
                <strong className="ml-1 text-bone">#{solicitudId}</strong> como referencia.
              </p>
              <button
                type="button"
                onClick={() => {
                  setSolicitudId(null);
                  setError("");
                }}
                className="mt-7 rounded-lg border border-ember px-6 py-3 text-sm font-semibold text-ember hover:bg-ember/10"
              >
                Enviar otra consulta
              </button>
            </div>
          ) : (
            <>
              <div className="mb-8">
                <h3 className="font-display text-3xl font-extrabold uppercase tracking-wide">
                  DEJANOS TU CONSULTA
                </h3>
                <p className="mt-2 text-sm text-bone-dim">
                  Completá los datos y contanos en qué podemos ayudarte.
                </p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label htmlFor="forge-consulta-nombre" className="block text-sm font-semibold">
                    Nombre y apellido
                  </label>
                  <input
                    id="forge-consulta-nombre"
                    name="nombre"
                    type="text"
                    autoComplete="name"
                    required
                    maxLength={150}
                    placeholder="Tu nombre completo"
                    value={nombre}
                    onChange={(event) => setNombre(event.target.value)}
                    disabled={enviando}
                    className={campo}
                  />
                </div>
                <div>
                  <label htmlFor="forge-consulta-email" className="block text-sm font-semibold">
                    Correo electrónico
                  </label>
                  <input
                    id="forge-consulta-email"
                    name="email"
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    required
                    maxLength={254}
                    placeholder="tuemail@gmail.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    disabled={enviando}
                    className={campo}
                  />
                </div>
                <div>
                  <label htmlFor="forge-consulta-mensaje" className="block text-sm font-semibold">
                    Mensaje
                  </label>
                  <textarea
                    id="forge-consulta-mensaje"
                    name="mensaje"
                    rows={5}
                    required
                    maxLength={3000}
                    placeholder="Contanos qué necesitás saber..."
                    value={mensaje}
                    onChange={(event) => setMensaje(event.target.value)}
                    disabled={enviando}
                    className={`${campo} resize-y`}
                  />
                  <p className="mt-2 text-right text-xs tabular-nums text-bone-dim">
                    {mensaje.length}/3000
                  </p>
                </div>

                {error && (
                  <p
                    role="alert"
                    className="rounded-lg border border-ember/40 bg-ember/10 px-4 py-3 text-sm text-bone"
                  >
                    {error}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={enviando}
                  className="w-full rounded-lg bg-ember px-6 py-4 text-sm font-extrabold uppercase tracking-[.09em] text-white hover:bg-ember-bright disabled:cursor-wait disabled:opacity-60"
                >
                  {enviando ? "Enviando consulta..." : "Enviar consulta"}
                </button>
                <p className="text-center text-xs leading-5 text-bone-dim">
                  Usamos tus datos únicamente para gestionar la consulta.
                  {" "}
                  <Link href="/privacidad" className="underline decoration-ember underline-offset-2 hover:text-bone">
                    Política de privacidad
                  </Link>
                </p>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
