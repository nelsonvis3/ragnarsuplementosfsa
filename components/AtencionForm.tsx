"use client";

import { useState, type FormEvent } from "react";
import { enviarSolicitudAtencion } from "@/lib/api";

type TipoSolicitud = "arrepentimiento" | "reclamo" | "consulta";

export default function AtencionForm({ tipoInicial }: { tipoInicial: TipoSolicitud }) {
  const [tipo, setTipo] = useState<TipoSolicitud>(tipoInicial);
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");
  const [numeroPedido, setNumeroPedido] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState("");
  const [solicitudId, setSolicitudId] = useState<number | null>(null);

  async function enviar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setEnviando(true);
    try {
      const respuesta = await enviarSolicitudAtencion({
        tipo,
        nombre: nombre.trim(),
        email: email.trim(),
        telefono: telefono.trim(),
        numero_pedido: numeroPedido.trim(),
        mensaje: mensaje.trim(),
      });
      setSolicitudId(respuesta.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos enviar la solicitud.");
    } finally {
      setEnviando(false);
    }
  }

  if (solicitudId) {
    return (
      <div className="border border-signal/50 bg-signal/10 p-6" role="status">
        <h2 className="font-display text-xl font-semibold">Solicitud recibida</h2>
        <p className="mt-2 text-sm text-bone-dim">Guardá este número para consultar: <strong>#{solicitudId}</strong>.</p>
        <button className="mt-5 text-sm text-ember underline" onClick={() => setSolicitudId(null)}>Enviar otra solicitud</button>
      </div>
    );
  }

  return (
    <form onSubmit={enviar} className="border border-carbon-line bg-carbon-raised p-5 sm:p-7">
      <label htmlFor="atencion-tipo" className="mb-2 block text-sm font-medium">Motivo</label>
      <select id="atencion-tipo" value={tipo} onChange={(event) => setTipo(event.target.value as TipoSolicitud)} className="mb-5 w-full border border-carbon-line bg-carbon px-3 py-3 text-sm">
        <option value="arrepentimiento">Arrepentimiento de compra</option>
        <option value="reclamo">Reclamo</option>
        <option value="consulta">Consulta</option>
      </select>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="atencion-nombre" className="mb-2 block text-sm">Nombre y apellido</label>
          <input id="atencion-nombre" required maxLength={150} autoComplete="name" value={nombre} onChange={(event) => setNombre(event.target.value)} className="w-full border border-carbon-line bg-carbon px-3 py-3 text-sm" />
        </div>
        <div>
          <label htmlFor="atencion-email" className="mb-2 block text-sm">Email</label>
          <input id="atencion-email" required type="email" maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} className="w-full border border-carbon-line bg-carbon px-3 py-3 text-sm" />
        </div>
        <div>
          <label htmlFor="atencion-telefono" className="mb-2 block text-sm">Teléfono (opcional)</label>
          <input id="atencion-telefono" type="tel" maxLength={30} autoComplete="tel" value={telefono} onChange={(event) => setTelefono(event.target.value)} className="w-full border border-carbon-line bg-carbon px-3 py-3 text-sm" />
        </div>
        {tipo === "arrepentimiento" && (
          <div>
            <label htmlFor="atencion-pedido" className="mb-2 block text-sm">Número de pedido</label>
            <input id="atencion-pedido" required maxLength={30} value={numeroPedido} onChange={(event) => setNumeroPedido(event.target.value)} className="w-full border border-carbon-line bg-carbon px-3 py-3 text-sm" />
          </div>
        )}
      </div>

      {tipo !== "arrepentimiento" && (
        <div className="mt-4">
          <label htmlFor="atencion-mensaje" className="mb-2 block text-sm">Mensaje</label>
          <textarea id="atencion-mensaje" required maxLength={3000} rows={5} value={mensaje} onChange={(event) => setMensaje(event.target.value)} className="w-full resize-y border border-carbon-line bg-carbon px-3 py-3 text-sm" />
        </div>
      )}

      {error && <p role="alert" className="mt-4 border border-ember/40 bg-ember/10 p-3 text-sm text-ember">{error}</p>}
      <button type="submit" disabled={enviando} className="mt-5 w-full bg-ember px-5 py-3 text-sm font-semibold text-carbon hover:bg-ember-bright disabled:opacity-60">
        {enviando ? "Enviando…" : tipo === "arrepentimiento" ? "Enviar solicitud" : "Enviar mensaje"}
      </button>
    </form>
  );
}
