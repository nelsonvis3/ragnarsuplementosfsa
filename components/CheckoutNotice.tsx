"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCartStore } from "@/store/cart-store";

function CheckoutNoticeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pago = searchParams.get("pago");

  useEffect(() => {
    if (pago === "exitoso") {
      void useCartStore.persist.rehydrate().then(() => useCartStore.getState().vaciarCarrito());
    }
  }, [pago]);

  if (!pago) return null;

  const mensajes: Record<string, string> = {
    exitoso: "¡Pago aprobado! Gracias por comprar en Ragnar Suplementos.",
    pendiente: "Tu pago está pendiente. Mercado Pago actualizará el estado cuando lo confirme.",
    fallido: "No se pudo completar el pago. Tu carrito sigue guardado para que puedas intentarlo otra vez.",
  };
  const mensaje = mensajes[pago];
  if (!mensaje) return null;

  return (
    <div className="mx-auto mt-5 flex max-w-6xl items-center justify-between gap-4 border border-ember/40 bg-ember/10 px-5 py-4 text-sm">
      <p>{mensaje}</p>
      <button
        type="button"
        onClick={() => router.replace("/", { scroll: false })}
        className="shrink-0 text-ember hover:text-ember-bright"
        aria-label="Cerrar aviso de pago"
      >
        Cerrar
      </button>
    </div>
  );
}

export default function CheckoutNotice() {
  return (
    <Suspense fallback={null}>
      <CheckoutNoticeContent />
    </Suspense>
  );
}
