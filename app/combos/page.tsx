"use client";

import { useEffect, useState } from "react";
import ComboCard from "@/components/ComboCard";
import { listarCombos } from "@/lib/api";
import type { Combo } from "@/types/producto";

export default function CombosPage() {
  const [combos, setCombos] = useState<Combo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    listarCombos()
      .then((datos) => {
        if (vigente) setCombos(datos);
      })
      .catch((err: unknown) => {
        if (vigente) setError(err instanceof Error ? err.message : "No pudimos cargar los combos.");
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, []);

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <span className="text-xs font-medium uppercase tracking-[0.3em] text-ember">
          Ahorrá comprando en combo
        </span>
        <h1 className="mt-2 font-display text-4xl font-semibold sm:text-5xl">Nuestros combos</h1>
        <p className="mt-4 max-w-xl text-bone-dim">
          Combinaciones pensadas para tu entrenamiento, a un precio mejor que comprando cada producto por separado.
        </p>

        {cargando && <p className="mt-10 text-bone-dim">Cargando combos…</p>}
        {error && <p className="mt-10 border border-ember/40 p-4 text-ember">{error}</p>}
        {!cargando && !error && combos.length === 0 && (
          <p className="mt-10 text-bone-dim">Todavía no hay combos publicados.</p>
        )}
        {!cargando && !error && combos.length > 0 && (
          <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {combos.map((combo) => <ComboCard key={combo.id} combo={combo} />)}
          </div>
        )}
      </div>
    </main>
  );
}
