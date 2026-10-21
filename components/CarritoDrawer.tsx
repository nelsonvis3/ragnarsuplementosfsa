"use client";

import { createPortal } from "react-dom";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ShoppingBag, Trash2, X } from "lucide-react";
import { useCartStore } from "@/store/cart-store";
import { listarCombos, listarProductos } from "@/lib/api";
import type { Combo, Producto } from "@/types/producto";

interface CartDrawerProps {
  abierto: boolean;
  onCerrar: () => void;
}

const dinero = (n: number) => "$" + n.toLocaleString("es-AR");

export default function CartDrawer({ abierto, onCerrar }: CartDrawerProps) {
  const [productos, setProductos] = useState<Producto[]>([]);
  const [combosCatalogo, setCombosCatalogo] = useState<Combo[]>([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState(false);
  const cerrarRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const previoRef = useRef<HTMLElement | null>(null);

  const items = useCartStore((s) => s.items);
  const combos = useCartStore((s) => s.combos);
  const eliminarItem = useCartStore((s) => s.eliminarItem);
  const eliminarCombo = useCartStore((s) => s.eliminarCombo);
  const cantidad = items.reduce((s, item) => s + item.cantidad, 0)
    + combos.reduce((s, item) => s + item.cantidad, 0);

  const productoPorId = useMemo(
    () => new Map(productos.map((p) => [p.id, p])),
    [productos]
  );
  const comboPorId = useMemo(
    () => new Map(combosCatalogo.map((c) => [c.id, c])),
    [combosCatalogo]
  );

  useEffect(() => {
    if (!abierto) return;
    previoRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const overflowAntes = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    cerrarRef.current?.focus();
    const manejarTeclado = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onCerrar();
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusables = Array.from(
        panelRef.current.querySelectorAll<HTMLElement>(
          'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
        )
      ).filter((node) => node.getClientRects().length > 0);
      if (!focusables.length) return;
      const primero = focusables[0];
      const ultimo = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === primero) {
        event.preventDefault();
        ultimo.focus();
      } else if (!event.shiftKey && document.activeElement === ultimo) {
        event.preventDefault();
        primero.focus();
      }
    };
    document.addEventListener("keydown", manejarTeclado);
    return () => {
      document.body.style.overflow = overflowAntes;
      document.removeEventListener("keydown", manejarTeclado);
      previoRef.current?.focus();
    };
  }, [abierto, onCerrar]);

  useEffect(() => {
    if (!abierto) return;
    let active = true;
    setCargando(true);
    setError(false);
    Promise.all([listarProductos(), listarCombos()])
      .then(([prods, cmbs]) => {
        if (!active) return;
        setProductos(prods);
        setCombosCatalogo(cmbs);
      })
      .catch(() => { if (active) setError(true); })
      .finally(() => { if (active) setCargando(false); });
    return () => { active = false; };
  }, [abierto]);

  if (!abierto) return null;

  const subtotal = items.reduce((sum, line) => {
    const producto = productoPorId.get(line.productoId);
    return sum + (producto ? producto.precio * line.cantidad : 0);
  }, 0) + combos.reduce((sum, line) => {
    const combo = comboPorId.get(line.comboId);
    return sum + (combo ? combo.precio * line.cantidad : 0);
  }, 0);
  const hasCart = cantidad > 0;
  const catalogoCompleto = !cargando && !error &&
    items.every((item) => productoPorId.has(item.productoId)) &&
    combos.every((item) => comboPorId.has(item.comboId));

  return createPortal(
    <div className="fixed inset-0 z-[100]" role="presentation">
      <button
        className="absolute inset-0 w-full bg-black/70 backdrop-blur-[3px]"
        aria-label="Cerrar vista rápida del carrito"
        type="button"
        onClick={onCerrar}
      />
      <section
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-quick-title"
        className="forge-cart-side absolute inset-y-0 right-0 flex flex-col border-l border-carbon-line"
      >
        <div className="flex items-center justify-between border-b border-carbon-line px-5 py-5 sm:px-7">
          <div>
            <p className="forge-eyebrow">TU SELECCIÓN</p>
            <h2 id="cart-quick-title" className="mt-1 font-display text-2xl font-extrabold tracking-tight">
              CARRITO <span className="text-bone-dim">({cantidad})</span>
            </h2>
          </div>
          <button
            ref={cerrarRef}
            onClick={onCerrar}
            type="button"
            aria-label="Cerrar carrito"
            className="flex h-10 w-10 items-center justify-center border border-carbon-line text-bone hover:border-ember"
          >
            <X size={20} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-6 sm:px-7">
          {!hasCart ? (
            <div className="flex h-full flex-col items-center justify-center text-center">
              <ShoppingBag size={40} strokeWidth={1.3} className="text-ember" />
              <h3 className="mt-5 font-display text-2xl font-bold uppercase">Tu carrito está vacío</h3>
              <p className="mt-3 max-w-[270px] text-sm leading-6 text-bone-dim">
                Encontrá tu próximo suplemento y sumalo a tu selección.
              </p>
              <Link
                href="/productos"
                onClick={onCerrar}
                className="mt-7 border border-ember px-6 py-3 text-sm font-bold text-ember hover:bg-ember/10"
              >
                Explorar catálogo
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {cargando && <p className="text-xs text-bone-dim">Consultando el catálogo…</p>}
              {error && (
                <p role="status" className="rounded-lg border border-carbon-line bg-carbon px-4 py-3 text-sm text-bone-dim">
                  No pudimos actualizar los precios ahora. Revisalos al abrir el carrito.
                </p>
              )}

              {items.map((item) => {
                const p = productoPorId.get(item.productoId);
                const imagen = item.sabor
                  ? p?.sabores.find((s) => s.nombre === item.sabor)?.imagen || p?.imagen
                  : p?.imagen;
                return (
                  <div className="flex gap-3 rounded-xl border border-carbon-line bg-carbon p-3" key={`${item.productoId}-${item.sabor || "default"}`}>
                    <div className="relative h-[80px] w-[80px] shrink-0 overflow-hidden rounded-lg bg-carbon-raised">
                      {imagen ? (
                        <Image alt={p?.nombre || "Producto"} src={imagen} fill sizes="80px" className="object-contain p-2" />
                      ) : <ShoppingBag size={26} className="m-auto mt-6 text-bone-dim"/>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold leading-snug">{p?.nombre || `Producto #${item.productoId}`}</p>
                      {item.sabor && <p className="mt-1 text-xs text-bone-dim">Sabor: {item.sabor}</p>}
                      <p className="mt-1 text-xs text-bone-dim">Cantidad: {item.cantidad}</p>
                      <p className="mt-2 text-sm font-bold">{p ? dinero(p.precio * item.cantidad) : "Precio a verificar"}</p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Quitar ${p?.nombre || "producto"}`}
                      onClick={() => eliminarItem(item.productoId, item.sabor)}
                      className="self-start p-1 text-bone-dim hover:text-ember"
                    >
                      <Trash2 size={17} />
                    </button>
                  </div>
                );
              })}

              {combos.map((item) => {
                const c = comboPorId.get(item.comboId);
                return (
                  <div className="flex gap-3 rounded-xl border border-carbon-line bg-carbon p-3" key={`combo-${item.comboId}`}>
                    <div className="relative h-[80px] w-[80px] shrink-0 overflow-hidden rounded-lg bg-carbon-raised">
                      {c ? <Image alt={c.nombre} src={c.imagen} fill sizes="80px" className="object-contain p-2"/> : <ShoppingBag size={26} className="m-auto mt-6 text-bone-dim"/>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-ember">COMBO</span>
                      <p className="text-sm font-semibold leading-snug">{c?.nombre || `Combo #${item.comboId}`}</p>
                      <p className="mt-1 text-xs text-bone-dim">Cantidad: {item.cantidad}</p>
                      <p className="mt-2 text-sm font-bold">{c ? dinero(c.precio * item.cantidad) : "Precio a verificar"}</p>
                    </div>
                    <button
                      type="button"
                      aria-label={`Quitar ${c?.nombre || "combo"}`}
                      onClick={() => eliminarCombo(item.comboId)}
                      className="self-start p-1 text-bone-dim hover:text-ember"
                    >
                      <Trash2 size={17}/>
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="border-t border-carbon-line bg-carbon-raised px-5 pb-6 pt-5 sm:px-7">
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-bone-dim">Subtotal estimado</span>
            <strong className="font-display text-xl font-bold">
              {catalogoCompleto ? dinero(subtotal) : "A confirmar"}
            </strong>
          </div>
          <p className="mt-2 text-xs leading-5 text-bone-dim">
            Precios y disponibilidad se vuelven a comprobar en el checkout. El envío se calcula aparte.
          </p>
          <Link
            href="/carrito"
            onClick={onCerrar}
            className="mt-5 flex min-h-13 w-full items-center justify-center bg-ember px-6 py-3.5 text-center text-sm font-bold uppercase tracking-wider text-white hover:bg-ember-bright"
          >
            Ver carrito
          </Link>
          <button
            onClick={onCerrar}
            type="button"
            className="mt-2 w-full py-2.5 text-center text-sm font-semibold text-bone-dim hover:text-bone"
          >
            Seguir comprando
          </button>
        </div>
      </section>
    </div>,
    document.body
  );
}
