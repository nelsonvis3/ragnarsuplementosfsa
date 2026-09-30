"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import ProductoCard from "@/components/ProductoCard";
import { listarProductos } from "@/lib/api";
import type { Producto } from "@/types/producto";

export default function Destacados() {
  const [destacados, setDestacados] = useState<Producto[]>([]);

  useEffect(() => {
    let vigente = true;
    listarProductos()
      .then((productos) => {
        if (vigente) setDestacados(productos.slice(0, 4));
      })
      .catch(() => {
        if (vigente) setDestacados([]);
      });
    return () => {
      vigente = false;
    };
  }, []);

  return (
    <section className="mx-auto max-w-6xl px-5 py-20">
      <div className="flex items-end justify-between border-b border-carbon-line pb-6">
        <div>
          <span className="font-display text-sm font-medium uppercase tracking-[0.2em] text-ember">Catálogo</span>
          <h2 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">Lo más pedido</h2>
        </div>
        <Link href="/productos" className="hidden text-sm text-bone-dim transition-colors hover:text-ember sm:block">
          Ver todo →
        </Link>
      </div>

      {destacados.length > 0 && (
        <div className="mt-10 grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
          {destacados.map((producto) => <ProductoCard key={producto.id} producto={producto} />)}
        </div>
      )}

      <Link href="/productos" className="mt-8 block text-center text-sm text-bone-dim transition-colors hover:text-ember sm:hidden">
        Ver todo el catálogo →
      </Link>
    </section>
  );
}
