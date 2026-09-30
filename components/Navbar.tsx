"use client";

import { createPortal } from "react-dom";
import Link from "next/link";
import { useState } from "react";
import { Menu, X, ShoppingCart, User, LogOut } from "lucide-react";
import { useCartStore } from "@/store/cart-store";
import { useAuthStore } from "@/store/auth-store";
import CartDrawer from "@/components/CarritoDrawer";
import ThemeToggle from "@/components/ThemeToggle";
import Logo from "@/components/Logo";

const LINKS_NAV = [
  { href: "/productos", label: "Catálogo", ancla: false },
  { href: "/atencion?tipo=arrepentimiento", label: "Botón de arrepentimiento", ancla: false },
  { href: "/#nosotros", label: "Nosotros", ancla: true },
  { href: "/#contacto", label: "Contacto", ancla: true },
];

export default function Navbar() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  const [carritoAbierto, setCarritoAbierto] = useState(false);

  const cantidadCarrito = useCartStore((state) => {
    const cantidadItems = state.items.reduce((total, item) => total + item.cantidad, 0);
    const cantidadCombos = state.combos.reduce((total, combo) => total + combo.cantidad, 0);
    return cantidadItems + cantidadCombos;
  });

  const usuario = useAuthStore((state) => state.usuario);
  const cerrarSesion = useAuthStore((state) => state.cerrarSesion);

  return (
    <header className="sticky top-0 z-50 border-b border-carbon-line bg-carbon/95 backdrop-blur">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Logo
            width={36}
            height={59}
            className="h-9 w-auto"
            priority
          />
          <span className="font-display text-xl font-semibold tracking-wide">
            RAGNAR
          </span>
        </Link>

        {/* Nav desktop — agrupado a la derecha, no centrado */}
        <nav className="hidden items-center gap-8 lg:flex">
          {LINKS_NAV.map((link) => (
            link.ancla ? (
              <a key={link.href} href={link.href} className="text-sm text-bone-dim transition-colors hover:text-bone">
                {link.label}
              </a>
            ) : (
              <Link key={link.href} href={link.href} className="whitespace-nowrap text-sm text-bone-dim transition-colors hover:text-bone">
                {link.label}
              </Link>
            )
          ))}
        </nav>

        <div className="hidden items-center gap-4 lg:flex">
          {usuario ? (
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-2 text-sm text-bone-dim">
                <User size={16} />
                {usuario.nombre_completo.split(" ")[0]}
              </span>
              <button
                onClick={cerrarSesion}
                aria-label="Cerrar sesión"
                className="flex items-center gap-2 border border-carbon-line px-3 py-2 text-sm transition-colors hover:border-ember"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <Link
              href="/login"
              className="flex items-center gap-2 border border-carbon-line px-4 py-2 text-sm transition-colors hover:border-ember"
            >
              <User size={16} />
              Ingresar
            </Link>
          )}

          <button
            aria-label="Ver carrito"
            onClick={() => setCarritoAbierto(true)}
            className="relative border border-carbon-line px-3 py-2 transition-colors hover:border-ember"
          >
            <ShoppingCart size={18} />
            <span className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center bg-ember text-xs font-semibold text-carbon">
              {cantidadCarrito}
            </span>
          </button>

          <ThemeToggle />
        </div>

        {/* Botón hamburguesa — solo mobile */}
        <button
          aria-label="Abrir menú"
          onClick={() => setMenuAbierto(true)}
          className="border border-carbon-line p-2 lg:hidden"
        >
          <Menu size={20} />
        </button>
      </div>

      <div className="border-t border-carbon-line px-5 py-2 lg:hidden">
        <Link
          href="/atencion?tipo=arrepentimiento"
          className="block text-right text-xs text-bone-dim transition-colors hover:text-bone"
        >
          BOTÓN DE ARREPENTIMIENTO
        </Link>
      </div>

      {/* Panel mobile */}
      {menuAbierto &&
        createPortal(
          <div className="fixed inset-0 z-50 lg:hidden">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setMenuAbierto(false)}
            />
            <aside className="fixed right-0 top-0 z-50 h-full w-full max-w-xs border-l border-carbon-line bg-carbon-raised">
              <div className="flex items-center justify-between border-b border-carbon-line px-5 py-4">
                <span className="font-display text-sm font-semibold uppercase tracking-wide text-bone-dim">
                  Menú
                </span>
                <button
                  aria-label="Cerrar menú"
                  onClick={() => setMenuAbierto(false)}
                >
                  <X size={22} />
                </button>
              </div>

              <nav className="flex flex-col gap-1 p-5">
                {LINKS_NAV.map((link) => (
                  link.ancla ? (
                    <a key={link.href} href={link.href} onClick={() => setMenuAbierto(false)} className="px-3 py-3 text-base transition-colors hover:bg-carbon">
                      {link.label}
                    </a>
                  ) : (
                    <Link key={link.href} href={link.href} onClick={() => setMenuAbierto(false)} className="px-3 py-3 text-base transition-colors hover:bg-carbon">
                      {link.label}
                    </Link>
                  )
                ))}
              </nav>

              <div className="flex flex-col gap-3 p-5">
                {usuario ? (
                  <>
                    <p className="text-center text-sm text-bone-dim">
                      Hola, {usuario.nombre_completo.split(" ")[0]}
                    </p>
                    <button
                      onClick={() => {
                        cerrarSesion();
                        setMenuAbierto(false);
                      }}
                      className="flex items-center justify-center gap-2 border border-carbon-line px-4 py-3 text-sm"
                    >
                      <LogOut size={16} />
                      Cerrar sesión
                    </button>
                  </>
                ) : (
                  <Link
                    href="/login"
                    onClick={() => setMenuAbierto(false)}
                    className="border border-carbon-line px-4 py-3 text-center text-sm"
                  >
                    Ingresar
                  </Link>
                )}
                <button
                  onClick={() => {
                    setMenuAbierto(false);
                    setCarritoAbierto(true);
                  }}
                  className="flex items-center justify-center gap-2 border border-carbon-line px-4 py-3 text-sm"
                >
                  <ShoppingCart size={16} />
                  Ver carrito
                  <span className="ml-1 text-ember">{cantidadCarrito}</span>
                </button>

                <div className="flex justify-center">
                  <ThemeToggle />
                </div>
              </div>
            </aside>
          </div>,
          document.body
        )}

      <CartDrawer
        abierto={carritoAbierto}
        onCerrar={() => setCarritoAbierto(false)}
      />
    </header>
  );
}
