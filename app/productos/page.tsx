"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import ProductoCard from "@/components/ProductoCard";
import ComboCard from "@/components/ComboCard";
import { listarCombos, listarProductos } from "@/lib/api";
import type { Combo, Producto } from "@/types/producto";

function CatalogoContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const categoriaActiva = searchParams.get("categoria") || "todos";
  const [productos, setProductos] = useState<Producto[]>([]);
  const [combos, setCombos] = useState<Combo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let vigente = true;
    Promise.all([listarProductos(), listarCombos()])
      .then(([productosApi, combosApi]) => {
        if (!vigente) return;
        setProductos(productosApi);
        setCombos(combosApi);
      })
      .catch((err: unknown) => {
        if (vigente) setError(err instanceof Error ? err.message : "No pudimos cargar el catálogo.");
      })
      .finally(() => {
        if (vigente) setCargando(false);
      });
    return () => {
      vigente = false;
    };
  }, []);

  const categorias = ["todos", ...Array.from(new Set(productos.map((p) => p.categoria))), "combos"];
  const mostrandoCombos = categoriaActiva === "combos";
  const productosFiltrados =
    categoriaActiva === "todos" || mostrandoCombos
      ? productos
      : productos.filter((producto) => producto.categoria === categoriaActiva);

  function seleccionarCategoria(categoria: string) {
    if (categoria === "todos") router.push("/productos");
    else router.push(`/productos?categoria=${encodeURIComponent(categoria)}`);
  }

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <h1 className="font-display text-4xl font-semibold sm:text-5xl">Nuestros productos</h1>

        {!cargando && !error && (
          <div className="mt-8 flex flex-wrap gap-3">
            {categorias.map((categoria) => (
              <button
                key={categoria}
                onClick={() => seleccionarCategoria(categoria)}
                className={`border px-4 py-2 text-sm capitalize transition-colors ${
                  categoriaActiva === categoria
                    ? "border-ember bg-ember text-carbon"
                    : "border-carbon-line text-bone-dim hover:border-ember hover:text-ember"
                }`}
              >
                {categoria.replace("-", " ")}
              </button>
            ))}
          </div>
        )}

        {cargando && <p className="mt-10 text-bone-dim">Cargando catálogo…</p>}
        {error && <p className="mt-10 border border-ember/40 p-4 text-ember">{error}</p>}

        {!cargando && !error && (
          <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {mostrandoCombos
              ? combos.map((combo) => <ComboCard key={combo.id} combo={combo} />)
              : productosFiltrados.map((producto) => <ProductoCard key={producto.id} producto={producto} />)}
          </div>
        )}

        {!cargando && !error && (mostrandoCombos ? combos.length === 0 : productosFiltrados.length === 0) && (
          <p className="mt-10 text-center text-bone-dim">No hay productos en esta categoría todavía.</p>
        )}
      </div>
    </main>
  );
}

export default function CatalogoPage() {
  return (
    <Suspense fallback={null}>
      <CatalogoContent />
    </Suspense>
  );
}
