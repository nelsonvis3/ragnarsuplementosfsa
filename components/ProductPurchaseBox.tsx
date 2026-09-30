"use client";

import { useState } from "react";
import Image from "next/image";
import { Check, Minus, Plus } from "lucide-react";
import { Producto } from "@/types/producto";
import { useCartStore } from "@/store/cart-store";

function formatearPrecio(valor: number) {
  return `$${valor.toLocaleString("es-AR")}`;
}

type EstadoBoton = "idle" | "agregado" | "sin-stock";

export default function ProductPurchaseBox({
  producto,
}: {
  producto: Producto;
}) {
  const tieneSabores = producto.sabores.length > 0;

  const [saborActivo, setSaborActivo] = useState(
    tieneSabores ? producto.sabores[0] : null
  );
  const [cantidad, setCantidad] = useState(1);
  const [estadoBoton, setEstadoBoton] = useState<EstadoBoton>("idle");

  const agregarItem = useCartStore((state) => state.agregarItem);

  const sinStock = producto.stock <= 0;
  const imagenActual = saborActivo ? saborActivo.imagen : producto.imagen;

  function handleAgregar() {
    if (sinStock) return;

    const agregado = agregarItem(
      producto.id,
      saborActivo?.nombre ?? null,
      cantidad
    );
    setEstadoBoton(agregado ? "agregado" : "sin-stock");
    setTimeout(() => setEstadoBoton("idle"), 1800);
  }

  function cambiarCantidad(delta: number) {
    setCantidad((actual) =>
      Math.max(1, Math.min(producto.stock, actual + delta))
    );
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      {/* Galería de imagen */}
      <div className="relative aspect-square border border-carbon-line bg-carbon-raised">
        <Image
          src={imagenActual}
          alt={producto.nombre}
          fill
          className="object-contain p-10"
          sizes="(min-width: 1024px) 50vw, 100vw"
          priority
        />
      </div>

      {/* Info y compra */}
      <div>
        <span className="text-xs uppercase tracking-wide text-ember">
          {producto.categoria.replace("-", " ")}
        </span>

        <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
          {producto.nombre}
        </h1>

        <p className="mt-4 text-2xl font-semibold text-ember">
          {formatearPrecio(producto.precio)}
        </p>

        <p className="mt-4 text-bone-dim">{producto.descripcion}</p>

        {/* Selector de sabor */}
        {tieneSabores && (
          <div className="mt-8">
            <span className="text-sm font-medium">Elegí tu sabor:</span>
            <div className="mt-3 flex flex-wrap gap-2">
              {producto.sabores.map((sabor) => (
                <button
                  key={sabor.nombre}
                  onClick={() => setSaborActivo(sabor)}
                  className={`border px-4 py-2 text-sm transition-colors ${
                    saborActivo?.nombre === sabor.nombre
                      ? "border-ember bg-ember text-carbon"
                      : "border-carbon-line text-bone-dim hover:border-ember hover:text-ember"
                  }`}
                >
                  {sabor.nombre}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Control de cantidad */}
        <div className="mt-8">
          <span className="text-sm font-medium">Cantidad:</span>
          <div className="mt-3 flex w-fit items-center border border-carbon-line">
            <button
              onClick={() => cambiarCantidad(-1)}
              className="p-3 text-bone-dim transition-colors hover:text-ember"
              aria-label="Restar"
            >
              <Minus size={16} />
            </button>

            <span className="w-10 text-center font-medium">{cantidad}</span>

            <button
              onClick={() => cambiarCantidad(1)}
              className="p-3 text-bone-dim transition-colors hover:text-ember"
              aria-label="Sumar"
            >
              <Plus size={16} />
            </button>
          </div>

          {producto.stock <= 5 && !sinStock && (
            <p className="mt-2 text-xs text-ember">
              ¡Últimas {producto.stock} unidades!
            </p>
          )}
        </div>

        {/* Botón de agregar con feedback visual */}
        <button
          onClick={handleAgregar}
          disabled={sinStock}
          className={`mt-8 flex w-full items-center justify-center gap-2 px-7 py-4 text-sm font-semibold uppercase tracking-wide transition-colors ${
            sinStock
              ? "cursor-not-allowed bg-carbon-line text-bone-dim"
              : estadoBoton === "agregado"
                ? "bg-signal text-carbon"
                : "bg-ember text-carbon hover:bg-ember-bright"
          }`}
        >
          {sinStock ? (
            "Sin stock"
          ) : estadoBoton === "agregado" ? (
            <>
              <Check size={18} />
              Agregado al carrito
            </>
          ) : estadoBoton === "sin-stock" ? (
            "Stock insuficiente para esa cantidad"
          ) : (
            "Agregar al carrito"
          )}
        </button>
      </div>
    </div>
  );
}