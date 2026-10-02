"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Check } from "lucide-react";
import type { Combo } from "@/types/producto";
import { useCartStore } from "@/store/cart-store";

function formatearPrecio(valor: number) {
  return `$${valor.toLocaleString("es-AR")}`;
}

type EstadoBoton = "idle" | "agregado" | "sin-stock";

export default function ComboPurchaseBox({ combo }: { combo: Combo }) {
  const [estadoBoton, setEstadoBoton] = useState<EstadoBoton>("idle");
  const agregarCombo = useCartStore((state) => state.agregarCombo);

  const productos = combo.productos ?? [];
  const stock = combo.stock ?? 0;
  const sinStock = stock <= 0;
  const precioSumado = productos.reduce((total, producto) => total + producto.precio, 0);
  const ahorro = Math.max(0, precioSumado - combo.precio);

  function handleAgregar() {
    if (sinStock) return;

    // El combo entra al carrito como línea propia, con su precio fijo.
    const itemsEnCarrito = useCartStore.getState().items;
    const combosEnCarrito = useCartStore.getState().combos;
    const stockDisponibleComponentes = productos.length
      ? Math.min(...productos.map((producto) => {
          const requeridoPorProductos = itemsEnCarrito
            .filter((item) => item.productoId === producto.id)
            .reduce((total, item) => total + item.cantidad, 0);
          const requeridoPorOtrosCombos = combosEnCarrito
            .filter((item) => item.comboId !== combo.id && item.productosIds?.includes(producto.id))
            .reduce((total, item) => total + item.cantidad, 0);
          return Math.max(0, producto.stock - requeridoPorProductos - requeridoPorOtrosCombos);
        }))
      : 0;
    const agregado = agregarCombo(
      combo.id,
      combo.precio,
      1,
      Math.min(stock, stockDisponibleComponentes),
      combo.productosIds
    );

    setEstadoBoton(agregado ? "agregado" : "sin-stock");
    setTimeout(() => setEstadoBoton("idle"), 1800);
  }

  return (
    <div className="grid gap-10 lg:grid-cols-2">
      <div className="relative aspect-square border border-carbon-line bg-carbon-raised">
        <Image
          src={combo.imagen}
          alt={combo.nombre}
          fill
          className="object-contain p-10"
          sizes="(min-width: 1024px) 50vw, 100vw"
          priority
        />
      </div>

      <div>
        <span className="text-xs uppercase tracking-wide text-ember">
          Combo
        </span>

        <h1 className="mt-2 font-display text-3xl font-semibold sm:text-4xl">
          {combo.nombre}
        </h1>

        <div className="mt-4 flex items-baseline gap-3">
          <span className="text-2xl font-semibold text-ember">
            {formatearPrecio(combo.precio)}
          </span>

          {ahorro > 0 && (
            <span className="text-base text-bone-dim line-through">
              {formatearPrecio(precioSumado)}
            </span>
          )}
        </div>

        {ahorro > 0 && (
          <p className="mt-1 text-sm text-signal">
            Ahorrás {formatearPrecio(ahorro)} comprando el combo
          </p>
        )}

        <p className="mt-4 text-bone-dim">{combo.descripcion}</p>

        {/* Productos incluidos */}
        <div className="mt-8">
          <span className="text-sm font-medium">Incluye:</span>

          <div className="mt-3 flex flex-col gap-3">
            {productos.map((producto) => (
              <Link
                key={producto.id}
                href={`/productos/${producto.slug}`}
                className="flex items-center gap-3 border border-carbon-line p-3 transition-colors hover:border-ember"
              >
                <div className="relative h-12 w-12 shrink-0 bg-carbon">
                  <Image
                    src={producto.imagen}
                    alt={producto.nombre}
                    fill
                    className="object-contain p-1"
                  />
                </div>

                <div className="flex-1">
                  <p className="text-sm font-medium">{producto.nombre}</p>
                  <p className="text-xs text-bone-dim">
                    {formatearPrecio(producto.precio)}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {stock <= 5 && !sinStock && (
          <p className="mt-4 text-xs text-ember">
            ¡Últimas {stock} unidades disponibles!
          </p>
        )}

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
            "Stock insuficiente para ese combo"
          ) : (
            "Agregar combo al carrito"
          )}
        </button>
      </div>
    </div>
  );
}
