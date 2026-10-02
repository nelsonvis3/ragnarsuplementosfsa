"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { verificarPagoRetorno } from "@/lib/api";
import { useCartStore } from "@/store/cart-store";

function CheckoutNoticeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pago = searchParams.get("pago");
  const pedidoId = searchParams.get("pedido_id");
  const token = searchParams.get("token");
  const paymentId = searchParams.get("payment_id") ?? searchParams.get("collection_id");
  const [mensajeVerificacion, setMensajeVerificacion] = useState("");
  const [urlReintento, setUrlReintento] = useState("");

  useEffect(() => {
    if (!pago || !pedidoId || !token || !paymentId) return;
    let vigente = true;

    void verificarPagoRetorno(pedidoId, token, paymentId)
      .then(async ({ estado, init_point: initPoint }) => {
        if (!vigente) return;
        if (estado === "aprobado" || estado === "revisar_stock") {
          await useCartStore.persist.rehydrate();
          useCartStore.getState().vaciarCarrito();
          try {
            sessionStorage.removeItem("ragnar_checkout_key");
            sessionStorage.removeItem("ragnar_checkout_firma");
          } catch {
            // La confirmación del pago no depende del almacenamiento de sesión.
          }
          setUrlReintento("");
          setMensajeVerificacion(
            estado === "aprobado"
              ? `¡Pago aprobado para el pedido #${pedidoId}! Gracias por comprar en Ragnar Suplementos.`
              : `El pago del pedido #${pedidoId} fue aprobado y estamos revisando la disponibilidad. Nos contactaremos para coordinarlo.`
          );
        } else if (estado === "reembolsado") {
          setUrlReintento("");
          setMensajeVerificacion(`El pago del pedido #${pedidoId} fue reembolsado. Si necesitás ayuda, contactanos.`);
        } else if (estado === "contracargo") {
          setUrlReintento("");
          setMensajeVerificacion(`Mercado Pago informó un contracargo para el pedido #${pedidoId}. Contactanos para resolverlo.`);
        } else if (estado === "revision_pago") {
          setUrlReintento("");
          setMensajeVerificacion(`El pago del pedido #${pedidoId} requiere revisión. No vuelvas a pagar; contactanos para resolverlo.`);
        } else {
          setUrlReintento(initPoint);
          setMensajeVerificacion(
            initPoint
              ? "El pago todavía no está aprobado. Podés volver a Mercado Pago para reintentar; conservamos tu carrito."
              : "Mercado Pago todavía no confirmó el pago. Conservamos tu carrito."
          );
        }
      })
      .catch(() => {
        if (vigente) {
          setUrlReintento("");
          setMensajeVerificacion("No pudimos verificar el pago. Conservamos tu carrito; contactanos antes de volver a pagar.");
        }
      });

    return () => {
      vigente = false;
    };
  }, [pago, pedidoId, token, paymentId]);

  if (!pago) return null;

  const retornoValido = Boolean(pedidoId && token && paymentId);
  const mensaje = mensajeVerificacion || (
    retornoValido
      ? "Verificando el estado del pago…"
      : "No pudimos verificar el pago. Conservamos tu carrito; contactanos antes de volver a pagar."
  );

  return (
    <div className="mx-auto mt-5 flex max-w-6xl items-center justify-between gap-4 border border-ember/40 bg-ember/10 px-5 py-4 text-sm" role="status">
      <div>
        <p>{mensaje}</p>
        {urlReintento && <a href={urlReintento} className="mt-2 inline-block text-ember underline">Volver a Mercado Pago</a>}
      </div>
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
