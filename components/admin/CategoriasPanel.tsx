"use client";

import { useState } from "react";
import { Pencil, Trash2 } from "lucide-react";
import type { Categoria } from "@/lib/api";

const control = "border border-carbon-line bg-carbon px-3 py-2.5 text-sm outline-none focus:border-ember";

export default function CategoriasPanel({ categorias, productosPorCategoria, onCrear, onRenombrar, onEliminar }: {
  categorias: Categoria[];
  productosPorCategoria: Record<string, number>;
  onCrear: (nombre: string) => Promise<void>;
  onRenombrar: (id: number, nombre: string) => Promise<void>;
  onEliminar: (id: number) => Promise<void>;
}) {
  const [nombre, setNombre] = useState("");
  const [editando, setEditando] = useState<{ id: number; nombre: string } | null>(null);
  const [eliminando, setEliminando] = useState<number | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");

  async function ejecutar(accion: () => Promise<void>, exito: string) {
    setGuardando(true);
    setError("");
    setMensaje("");
    try {
      await accion();
      setMensaje(exito);
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "No pudimos guardar la categoría.");
      return false;
    } finally { setGuardando(false); }
  }

  async function crear(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await ejecutar(() => onCrear(nombre.trim()), `Categoría «${nombre.trim()}» creada. Ya podés asignarla a tus productos.`)) setNombre("");
  }

  async function renombrar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (editando && await ejecutar(() => onRenombrar(editando.id, editando.nombre.trim()), `Categoría renombrada a «${editando.nombre.trim()}».`)) setEditando(null);
  }

  return <details className="border border-carbon-line bg-carbon-raised p-5">
    <summary className="cursor-pointer font-display text-lg font-semibold focus-visible:outline-2 focus-visible:outline-ember">Categorías · {categorias.length}</summary>
    <p className="mt-3 text-sm text-bone-dim">Organizan los productos y los botones de filtro del catálogo. Al renombrar una categoría, sus productos la conservan.</p>
    <ul className="mt-4 divide-y divide-carbon-line border-y border-carbon-line" aria-label="Categorías existentes" aria-busy={guardando}>
      {categorias.map((categoria) => {
        const cantidad = productosPorCategoria[categoria.slug] ?? 0;
        return <li key={categoria.id} className="py-3">
          {editando?.id === categoria.id ? <form onSubmit={renombrar} className="flex flex-wrap items-center gap-2">
            <label className="min-w-0 flex-1"><span className="sr-only">Nuevo nombre de {categoria.nombre}</span>
              <input autoFocus required maxLength={80} value={editando.nombre} disabled={guardando} onChange={(e) => setEditando({ ...editando, nombre: e.target.value })} className={`${control} w-full`} />
            </label>
            <button type="submit" disabled={guardando || !editando.nombre.trim()} className="border border-ember px-4 py-2.5 text-sm font-semibold text-ember hover:bg-ember/10 disabled:opacity-50">{guardando ? "Guardando…" : "Guardar"}</button>
            <button type="button" disabled={guardando} onClick={() => setEditando(null)} className="px-3 py-2.5 text-sm text-bone-dim hover:text-bone">Cancelar</button>
          </form> : <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="min-w-0 break-words text-sm"><span className="font-medium">{categoria.nombre}</span><span className="ml-2 text-xs text-bone-dim">{cantidad} producto{cantidad === 1 ? "" : "s"}</span></p>
            <div className="flex items-center gap-1">
              <button type="button" disabled={guardando} onClick={() => { setEditando({ id: categoria.id, nombre: categoria.nombre }); setEliminando(null); setError(""); setMensaje(""); }} aria-label={`Renombrar ${categoria.nombre}`} title="Renombrar" className="p-2.5 text-bone-dim hover:bg-carbon hover:text-ember disabled:opacity-40"><Pencil size={16} /></button>
              <button type="button" disabled={guardando || cantidad > 0} onClick={() => { setEliminando(categoria.id); setEditando(null); setError(""); setMensaje(""); }} aria-label={`Eliminar ${categoria.nombre}`} title={cantidad > 0 ? "Tiene productos: pasalos a otra categoría antes de eliminarla" : "Eliminar"} className="p-2.5 text-bone-dim hover:bg-carbon hover:text-ember disabled:opacity-30"><Trash2 size={16} /></button>
            </div>
          </div>}
          {eliminando === categoria.id && <div className="mt-3 border border-ember/40 bg-carbon p-3 text-sm">
            <p>¿Eliminar «{categoria.nombre}»? Desaparece del filtro del catálogo.</p>
            <div className="mt-3 flex gap-3">
              <button type="button" disabled={guardando} onClick={async () => { if (await ejecutar(() => onEliminar(categoria.id), `Categoría «${categoria.nombre}» eliminada.`)) setEliminando(null); }} className="bg-ember px-4 py-2 text-sm font-semibold text-carbon disabled:opacity-60">{guardando ? "Eliminando…" : "Confirmar eliminación"}</button>
              <button type="button" disabled={guardando} onClick={() => setEliminando(null)} className="px-3 py-2 text-sm text-bone-dim hover:text-bone">Cancelar</button>
            </div>
          </div>}
        </li>;
      })}
    </ul>
    <form onSubmit={crear} className="mt-5 flex flex-wrap items-end gap-3" aria-busy={guardando}>
      <label className="min-w-0 flex-1 text-sm" htmlFor="nueva-categoria">Nueva categoría
        <input id="nueva-categoria" required maxLength={80} value={nombre} disabled={guardando} onChange={(e) => setNombre(e.target.value)} placeholder="Ej. Aminoácidos" className={`${control} mt-2 block w-full py-3`} />
      </label>
      <button type="submit" disabled={guardando || !nombre.trim()} className="min-h-12 border border-ember px-5 py-3 text-sm font-semibold text-ember hover:bg-ember/10 disabled:opacity-50">{guardando ? "Creando…" : "Crear categoría"}</button>
    </form>
    {error && <p role="alert" className="mt-3 text-sm text-ember">{error}</p>}
    {mensaje && <p role="status" className="mt-3 text-sm">{mensaje}</p>}
  </details>;
}
