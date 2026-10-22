"use client";

import { useState } from "react";
import type { Categoria } from "@/lib/api";

export default function CategoriasPanel({ categorias, onCrear }: {
  categorias: Categoria[];
  onCrear: (nombre: string) => Promise<void>;
}) {
  const [nombre, setNombre] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function crear(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      await onCrear(nombre.trim());
      setMensaje(`Categoría «${nombre.trim()}» creada. Ya podés asignarla a tus productos.`);
      setNombre("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos crear la categoría.");
    } finally { setGuardando(false); }
  }

  return <details className="mt-8 border border-carbon-line bg-carbon-raised p-5">
    <summary className="cursor-pointer font-display text-lg font-semibold focus-visible:outline-2 focus-visible:outline-ember">Categorías · {categorias.length} — Crear categoría</summary>
    <p className="mt-3 text-sm text-bone-dim">Organizá los productos y los filtros de la tienda.</p>
    <ul className="mt-4 flex flex-wrap gap-2" aria-label="Categorías existentes">
      {categorias.map((categoria) => <li key={categoria.id} className="max-w-full break-words border border-carbon-line px-3 py-2 text-sm">{categoria.nombre}</li>)}
    </ul>
    <form onSubmit={crear} className="mt-5 flex flex-wrap items-end gap-3" aria-busy={guardando}>
      <label className="min-w-0 flex-1 text-sm" htmlFor="nueva-categoria">Nombre de la categoría
        <input id="nueva-categoria" required maxLength={80} value={nombre} disabled={guardando} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Aminoácidos" className="mt-2 block w-full border border-carbon-line bg-carbon px-3 py-3 outline-none focus:border-ember" />
      </label>
      <button type="submit" disabled={guardando || !nombre.trim()} className="min-h-12 border border-ember px-5 py-3 text-sm font-semibold text-ember hover:bg-ember/10 disabled:opacity-50">{guardando ? "Creando…" : "Crear categoría"}</button>
    </form>
    {error && <p role="alert" className="mt-3 text-sm text-ember">{error}</p>}
    {mensaje && <p role="status" className="mt-3 text-sm">{mensaje}</p>}
  </details>;
}
