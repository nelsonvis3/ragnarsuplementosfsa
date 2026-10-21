import type { Metadata } from "next";
import Link from "next/link";
import CarritoCheckout from "@/components/CarritoCheckout";

export const metadata: Metadata = {
  title: "Tu carrito | Ragnar Suplementos",
  description: "Revisá tus productos, elegí la entrega y completá tu pedido en Ragnar Suplementos.",
};

export default function CarritoPage() {
  return (
    <main className="w-full flex-1">
      <div className="border-b border-carbon-line bg-carbon-raised/40">
        <div className="mx-auto max-w-7xl px-5 py-12 sm:px-8 sm:py-16">
          <span className="forge-eyebrow">RAGNAR / TU COMPRA</span>
          <h1 className="forge-title mt-3 text-4xl uppercase sm:text-6xl">REVISÁ TU CARRITO.</h1>
          <p className="mt-4 max-w-xl text-sm leading-7 text-bone-dim">
            Controlá tus productos, elegí cómo recibirlos y confirmá tu pedido con tranquilidad.
          </p>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-8 sm:py-14">
        <CarritoCheckout />
        <p className="mt-6 text-center text-xs text-bone-dim">
          ¿Querés seguir eligiendo?{" "}
          <Link href="/productos" className="font-semibold text-ember underline underline-offset-4">
            Volver al catálogo
          </Link>
        </p>
      </div>
    </main>
  );
}
