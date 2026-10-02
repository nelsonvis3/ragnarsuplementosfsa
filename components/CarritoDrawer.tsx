"use client";

import { createPortal } from "react-dom";
import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { X, Minus, Plus, Trash2 } from "lucide-react";
import { useCartStore } from "@/store/cart-store";
import { useAuthStore } from "@/store/auth-store";
import { ApiError, cotizarEnvio, crearPreferencia, listarCombos, listarMediosPago, listarProductos } from "@/lib/api";
import type { CotizacionEnvio, MedioPago, PedidoManual } from "@/lib/api";
import type { Combo, Producto } from "@/types/producto";

function formatearPrecio(valor: number) {
  return `$${valor.toLocaleString("es-AR")}`;
}

interface CartDrawerProps {
  abierto: boolean;
  onCerrar: () => void;
}

export default function CartDrawer({ abierto, onCerrar }: CartDrawerProps) {
  const items = useCartStore((state) => state.items);
  const combos = useCartStore((state) => state.combos);
  const actualizarCantidad = useCartStore((state) => state.actualizarCantidad);
  const eliminarItem = useCartStore((state) => state.eliminarItem);
  const actualizarCantidadCombo = useCartStore((state) => state.actualizarCantidadCombo);
  const eliminarCombo = useCartStore((state) => state.eliminarCombo);
  const usuario = useAuthStore((state) => state.usuario);
  const token = useAuthStore((state) => state.token);
  const [productos, setProductos] = useState<Producto[]>([]);
  const [catalogoCombos, setCatalogoCombos] = useState<Combo[]>([]);
  const [catalogoListo, setCatalogoListo] = useState(false);
  const [mediosPago, setMediosPago] = useState<MedioPago[]>([]);
  const [medioPago, setMedioPago] = useState<MedioPago["id"] | null>(null);
  const [pedidoManual, setPedidoManual] = useState<PedidoManual | null>(null);
  const [formaEntrega, setFormaEntrega] = useState<"retiro" | "envio">("retiro");
  const [direccionEntrega, setDireccionEntrega] = useState("");
  const [cotizacion, setCotizacion] = useState<CotizacionEnvio | null>(null);
  const [errorEnvio, setErrorEnvio] = useState<string | null>(null);
  // Lógica interna: Django calcula la ruta, aplica los tramos configurados en backend/.env
  // (1 km gratis; luego $1.000, $2.500, $3.500 y $5.000 hasta 12 km) y firma la cotización por 15 minutos.
  const [cotizandoEnvio, setCotizandoEnvio] = useState(false);
  const [nombre, setNombre] = useState("");
  const [nombreEditado, setNombreEditado] = useState(false);
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [emailEditado, setEmailEditado] = useState(false);
  const [checkoutCargando, setCheckoutCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const checkoutKey = useRef<string | null>(null);
  const checkoutFirma = useRef<string | null>(null);
  const catalogoCargando = abierto && !catalogoListo;
  const nombreCheckout = nombreEditado ? nombre : nombre || usuario?.nombre_completo || "";
  const emailCheckout = emailEditado ? email : email || usuario?.email || "";

  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    Promise.all([listarProductos(), listarCombos(), listarMediosPago()])
      .then(([productosApi, combosApi, metodosApi]) => {
        if (!vigente) return;
        setError(null);
        setProductos(productosApi);
        setCatalogoCombos(combosApi);
        setMediosPago(metodosApi.filter((metodo) => metodo.disponible));
        setMedioPago((actual) =>
          actual && metodosApi.some((metodo) => metodo.id === actual && metodo.disponible)
            ? actual
            : metodosApi.find((metodo) => metodo.disponible)?.id ?? null
        );
        const productosIds = new Set(productosApi.map((producto) => producto.id));
        const combosIds = new Set(combosApi.map((combo) => combo.id));
        const carrito = useCartStore.getState();
        const lineasObsoletas = [
          ...carrito.items.filter((item) => !productosIds.has(item.productoId)).map((item) => () => carrito.eliminarItem(item.productoId, item.sabor)),
          ...carrito.combos.filter((combo) => !combosIds.has(combo.comboId)).map((combo) => () => carrito.eliminarCombo(combo.comboId)),
        ];
        lineasObsoletas.forEach((quitar) => quitar());
        if (lineasObsoletas.length > 0) {
          setError("Quitamos del carrito artículos que ya no están publicados en el catálogo.");
        }
      })
      .catch((err: unknown) => {
        if (vigente) setError(err instanceof Error ? err.message : "No pudimos cargar el carrito.");
      })
      .finally(() => {
        if (vigente) setCatalogoListo(true);
      });
    return () => {
      vigente = false;
    };
  }, [abierto]);

  function cerrarDrawer() {
    setPedidoManual(null);
    setError(null);
    setCatalogoListo(false);
    onCerrar();
  }

  const productosPorId = useMemo(() => new Map(productos.map((producto) => [producto.id, producto])), [productos]);
  const combosPorId = useMemo(() => new Map(catalogoCombos.map((combo) => [combo.id, combo])), [catalogoCombos]);

  const itemsConDatos = items.flatMap((item) => {
    const producto = productosPorId.get(item.productoId);
    if (!producto) return [];
    const sabor = item.sabor ? producto.sabores.find((opcion) => opcion.nombre === item.sabor) : null;
    return [{ ...item, nombre: producto.nombre, precio: producto.precio, imagen: sabor?.imagen ?? producto.imagen }];
  });
  const combosConDatos = combos.flatMap((item) => {
    const combo = combosPorId.get(item.comboId);
    if (!combo) return [];
    return [{ ...item, nombre: combo.nombre, precio: combo.precio, imagen: combo.imagen }];
  });

  const totalProductos = itemsConDatos.reduce((total, item) => total + item.precio * item.cantidad, 0);
  const totalCombos = combosConDatos.reduce((total, combo) => total + combo.precio * combo.cantidad, 0);
  const subtotal = totalProductos + totalCombos;
  const costoEnvio = formaEntrega === "envio" ? (cotizacion?.costo_envio ?? 0) : 0;
  const total = subtotal + costoEnvio;
  const carritoVacio = items.length === 0 && combos.length === 0;
  const hayLineasSinCatalogo = itemsConDatos.length !== items.length || combosConDatos.length !== combos.length;
  const cantidadesPorProducto = useMemo(() => {
    const cantidades = new Map<number, number>();
    for (const item of items) {
      cantidades.set(item.productoId, (cantidades.get(item.productoId) ?? 0) + item.cantidad);
    }
    for (const item of combos) {
      const combo = combosPorId.get(item.comboId);
      for (const productoId of combo?.productosIds ?? item.productosIds ?? []) {
        cantidades.set(productoId, (cantidades.get(productoId) ?? 0) + item.cantidad);
      }
    }
    return cantidades;
  }, [items, combos, combosPorId]);
  const hayStockInsuficiente = productos.some(
    (producto) => (cantidadesPorProducto.get(producto.id) ?? 0) > producto.stock
  );

  function stockMaximoDeItem(productoId: number, cantidadActual: number) {
    const producto = productosPorId.get(productoId);
    if (!producto) return 0;
    return Math.max(0, producto.stock - ((cantidadesPorProducto.get(productoId) ?? 0) - cantidadActual));
  }

  function stockMaximoDeCombo(comboId: number, cantidadActual: number) {
    const combo = combosPorId.get(comboId);
    const ids = combo?.productosIds ?? [];
    if (!ids.length) return 0;
    return Math.max(0, Math.min(...ids.map((id) => {
      const producto = productosPorId.get(id);
      if (!producto) return 0;
      return producto.stock - ((cantidadesPorProducto.get(id) ?? 0) - cantidadActual);
    })));
  }
  const mensajeWhatsapp = pedidoManual
    ? pedidoManual.medio_pago === "transferencia"
      ? `Hola, realicé la transferencia del pedido #${pedidoManual.pedido_id} por ${formatearPrecio(pedidoManual.total)}. Adjunto el comprobante.`
      : pedidoManual.forma_entrega === "envio"
        ? `Hola, quiero coordinar la entrega a domicilio del pedido #${pedidoManual.pedido_id} por ${formatearPrecio(pedidoManual.total)}.`
        : `Hola, quiero coordinar el pago y retiro del pedido #${pedidoManual.pedido_id} por ${formatearPrecio(pedidoManual.total)}.`
    : "";
  const whatsappPedidoUrl = `https://wa.me/5493704696533?text=${encodeURIComponent(mensajeWhatsapp)}`;

  async function handleCotizarEnvio() {
    setErrorEnvio(null);
    if (!direccionEntrega.trim()) {
      setErrorEnvio("Escribí la calle, altura y barrio para calcular el envío.");
      return;
    }
    setCotizandoEnvio(true);
    setError(null);
    try {
      const resultado = await cotizarEnvio(direccionEntrega.trim());
      setCotizacion(resultado);
    } catch (err) {
      setCotizacion(null);
      setErrorEnvio(err instanceof Error ? err.message : "No pudimos calcular el envío.");
    } finally {
      setCotizandoEnvio(false);
    }
  }

  async function handleFinalizarCompra(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    if (hayLineasSinCatalogo) {
      setError("Hay artículos que ya no están disponibles. Quitalos del carrito para continuar.");
      return;
    }
    if (hayStockInsuficiente) {
      setError("La cantidad del carrito supera el stock actual. Ajustá los artículos antes de continuar.");
      return;
    }
    if (!medioPago) {
      setError("Elegí un medio de pago disponible.");
      return;
    }
    if (formaEntrega === "envio" && !cotizacion) {
      setError("Calculá el costo del envío antes de confirmar el pedido.");
      return;
    }
    setCheckoutCargando(true);
    try {
      const lineas = [
        ...items.map((item) => ({
          tipo: "producto" as const,
          id: item.productoId,
          cantidad: item.cantidad,
          ...(item.sabor ? { sabor: item.sabor } : {}),
        })),
        ...combos.map((combo) => ({ tipo: "combo" as const, id: combo.comboId, cantidad: combo.cantidad })),
      ];
      const firmaCheckout = JSON.stringify({
        lineas,
        nombre: nombreCheckout.trim(),
        telefono: telefono.trim(),
        email: emailCheckout.trim(),
        medioPago,
        formaEntrega,
        direccion: direccionEntrega.trim(),
        cotizacion: cotizacion?.cotizacion_envio ?? "",
        usuario: usuario?.id ?? null,
      });
      if (checkoutFirma.current !== firmaCheckout) {
        let claveGuardada: string | null = null;
        let firmaGuardada: string | null = null;
        try {
          claveGuardada = sessionStorage.getItem("ragnar_checkout_key");
          firmaGuardada = sessionStorage.getItem("ragnar_checkout_firma");
        } catch {
          // Si el navegador bloquea el almacenamiento, se mantiene la clave solo en memoria.
        }
        checkoutKey.current = claveGuardada && firmaGuardada === firmaCheckout ? claveGuardada : crypto.randomUUID();
        checkoutFirma.current = firmaCheckout;
      }
      const claveCheckout = checkoutKey.current ?? crypto.randomUUID();
      checkoutKey.current = claveCheckout;
      try {
        sessionStorage.setItem("ragnar_checkout_key", claveCheckout);
        sessionStorage.setItem("ragnar_checkout_firma", firmaCheckout);
      } catch {
        // El flujo de compra sigue funcionando aunque el navegador bloquee el almacenamiento de sesión.
      }
      const resultado = await crearPreferencia(
        lineas,
        nombreCheckout.trim(),
        telefono.trim(),
        emailCheckout.trim(),
        medioPago,
        claveCheckout,
        token,
        {
          forma: formaEntrega,
          ...(formaEntrega === "envio"
            ? { direccion: direccionEntrega.trim(), cotizacionEnvio: cotizacion?.cotizacion_envio }
            : {}),
        }
      );
      if (resultado.tipo === "manual") {
        setPedidoManual(resultado);
        checkoutKey.current = null;
        checkoutFirma.current = null;
        try {
          sessionStorage.removeItem("ragnar_checkout_key");
          sessionStorage.removeItem("ragnar_checkout_firma");
        } catch {
          // La confirmación del pedido no depende del almacenamiento de sesión.
        }
        useCartStore.getState().vaciarCarrito();
        setCheckoutCargando(false);
        return;
      }
      if (!resultado.init_point) throw new Error("Mercado Pago no devolvió el enlace de pago.");
      window.location.assign(resultado.init_point);
    } catch (err) {
      if (err instanceof ApiError && err.status === 409 && err.mensaje.includes("reserva del pedido anterior venció")) {
        checkoutKey.current = null;
        checkoutFirma.current = null;
        try {
          sessionStorage.removeItem("ragnar_checkout_key");
          sessionStorage.removeItem("ragnar_checkout_firma");
        } catch {
          // Se puede continuar con una clave nueva mantenida en memoria.
        }
      }
      setError(err instanceof Error ? err.message : "No pudimos iniciar el pago. Intentá de nuevo.");
      setCheckoutCargando(false);
    }
  }

  if (!abierto) return null;

  return createPortal(
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        aria-label="Cerrar carrito"
        onClick={cerrarDrawer}
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-dialog-title"
        className="relative z-10 flex h-full w-full max-w-5xl flex-col overflow-hidden border border-carbon-line bg-carbon-raised shadow-2xl sm:h-[min(92dvh,850px)]"
      >
        <div className="flex shrink-0 items-center justify-between border-b border-carbon-line px-5 py-4">
          <h2 id="cart-dialog-title" className="font-display text-lg font-semibold">Tu carrito</h2>
          <button type="button" aria-label="Cerrar carrito" onClick={cerrarDrawer} className="p-1 hover:text-ember">
            <X size={22} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain md:grid md:overflow-hidden md:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
          <section className={`border-b border-carbon-line p-4 sm:p-5 md:min-h-0 md:overflow-y-auto md:border-b-0 md:border-r ${!carritoVacio && !pedidoManual ? "shrink-0 md:flex-1" : "flex-1"}`}>
            {pedidoManual && (
              <div className="border border-signal/40 bg-signal/10 p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-signal">Pedido recibido</p>
                <h3 className="mt-2 font-display text-xl font-semibold">Pedido #{pedidoManual.pedido_id}</h3>
                <p className="mt-2 text-sm">Productos: {formatearPrecio(pedidoManual.total - pedidoManual.costo_envio)}</p>
                <p className="mt-1 text-sm">Envío: {formatearPrecio(pedidoManual.costo_envio)}</p>
                <p className="mt-1 text-sm font-semibold">Total: {formatearPrecio(pedidoManual.total)}</p>
                {pedidoManual.stock_reservado_hasta && <p className="mt-2 text-xs text-bone-dim">Reserva de productos hasta {new Date(pedidoManual.stock_reservado_hasta).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}.</p>}
                {pedidoManual.forma_entrega === "envio" && <p className="mt-2 text-sm">Entrega: {pedidoManual.direccion_entrega}</p>}
                <p className="mt-4 text-sm font-medium">{pedidoManual.datos_pago.titulo}</p>
                {pedidoManual.datos_pago.titular && <p className="mt-2 text-sm">Titular: {pedidoManual.datos_pago.titular}</p>}
                {pedidoManual.datos_pago.alias && <p className="mt-1 text-sm">Alias: <strong>{pedidoManual.datos_pago.alias}</strong></p>}
                {pedidoManual.datos_pago.cvu && <p className="mt-1 break-all text-sm">CVU: <strong>{pedidoManual.datos_pago.cvu}</strong></p>}
                <a
                  href={whatsappPedidoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-5 block w-full bg-ember px-4 py-3 text-center text-sm font-semibold uppercase tracking-wide text-carbon hover:bg-ember-bright"
                >
                  {pedidoManual.medio_pago === "transferencia"
                    ? "Enviar comprobante por WhatsApp"
                    : pedidoManual.forma_entrega === "envio"
                      ? "Coordinar envío por WhatsApp"
                      : "Coordinar retiro por WhatsApp"}
                </a>
              </div>
            )}
            {catalogoCargando && <p className="mt-8 text-center text-sm text-bone-dim">Actualizando precios y stock…</p>}
            {!pedidoManual && !catalogoCargando && carritoVacio && <p className="mt-10 text-center text-sm text-bone-dim">Tu carrito está vacío.</p>}

            {!pedidoManual && !catalogoCargando && !carritoVacio && (
              <div className="flex flex-col gap-2 sm:gap-3">
                {combosConDatos.map((combo) => (
                  <div key={`combo-${combo.comboId}`} className="flex items-center gap-2 border-b border-carbon-line pb-2 sm:gap-3 sm:pb-3">
                    <div className="relative h-10 w-10 shrink-0 bg-carbon sm:h-12 sm:w-12">
                      <Image src={combo.imagen} alt={combo.nombre} fill className="object-contain p-1" />
                    </div>
                    <div className="flex-1">
                      <span className="text-[10px] uppercase tracking-wide text-ember">Combo</span>
                      <p className="text-sm font-medium">{combo.nombre}</p>
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex items-center border border-carbon-line">
                          <button onClick={() => actualizarCantidadCombo(combo.comboId, -1, stockMaximoDeCombo(combo.comboId, combo.cantidad))} className="p-1.5 text-bone-dim hover:text-ember" aria-label="Restar"><Minus size={12} /></button>
                          <span className="w-6 text-center text-xs">{combo.cantidad}</span>
                          <button disabled={combo.cantidad >= stockMaximoDeCombo(combo.comboId, combo.cantidad)} onClick={() => actualizarCantidadCombo(combo.comboId, 1, stockMaximoDeCombo(combo.comboId, combo.cantidad))} className="p-1.5 text-bone-dim hover:text-ember disabled:opacity-40" aria-label="Sumar"><Plus size={12} /></button>
                        </div>
                        <button onClick={() => eliminarCombo(combo.comboId)} aria-label="Eliminar combo" className="text-bone-dim hover:text-ember"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <span className="text-sm font-semibold">{formatearPrecio(combo.precio * combo.cantidad)}</span>
                  </div>
                ))}

                {itemsConDatos.map((item) => (
                  <div key={`${item.productoId}-${item.sabor ?? "default"}`} className="flex items-center gap-2 border-b border-carbon-line pb-2 sm:gap-3 sm:pb-3">
                    <div className="relative h-10 w-10 shrink-0 bg-carbon sm:h-12 sm:w-12">
                      <Image src={item.imagen} alt={item.nombre} fill className="object-contain p-1" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.nombre}</p>
                      {item.sabor && <p className="text-xs text-bone-dim">Sabor: {item.sabor}</p>}
                      <div className="mt-1 flex items-center gap-2">
                        <div className="flex items-center border border-carbon-line">
                          <button onClick={() => actualizarCantidad(item.productoId, item.sabor, -1, stockMaximoDeItem(item.productoId, item.cantidad))} className="p-1.5 text-bone-dim hover:text-ember" aria-label="Restar"><Minus size={12} /></button>
                          <span className="w-6 text-center text-xs">{item.cantidad}</span>
                          <button disabled={item.cantidad >= stockMaximoDeItem(item.productoId, item.cantidad)} onClick={() => actualizarCantidad(item.productoId, item.sabor, 1, stockMaximoDeItem(item.productoId, item.cantidad))} className="p-1.5 text-bone-dim hover:text-ember disabled:opacity-40" aria-label="Sumar"><Plus size={12} /></button>
                        </div>
                        <button onClick={() => eliminarItem(item.productoId, item.sabor)} aria-label="Eliminar producto" className="text-bone-dim hover:text-ember"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <span className="text-sm font-semibold">{formatearPrecio(item.precio * item.cantidad)}</span>
                  </div>
                ))}
                {hayLineasSinCatalogo && <p className="text-sm text-ember">Hay productos desactualizados en tu carrito.</p>}
                {hayStockInsuficiente && <p className="text-sm text-ember">La cantidad supera el stock actualizado. Reducila antes de pagar.</p>}
              </div>
            )}
          </section>

          {!pedidoManual && !carritoVacio && (
            <form onSubmit={handleFinalizarCompra} className="shrink-0 p-3 sm:p-5 md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-contain">
              <fieldset className="mb-2 sm:mb-4">
                <legend className="mb-1 text-sm font-medium sm:mb-2">¿Cómo querés recibirlo?</legend>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex cursor-pointer items-start gap-2 border border-carbon-line p-2 sm:p-3 hover:border-ember">
                    <input
                      type="radio"
                      name="forma-entrega"
                      value="retiro"
                      checked={formaEntrega === "retiro"}
                      onChange={() => setFormaEntrega("retiro")}
                      className="mt-1 accent-ember"
                    />
                    <span>
                      <span className="block text-sm font-medium">Retirar en el local</span>
                      <span className="mt-1 hidden text-xs text-bone-dim sm:block">Azcuénaga 991, Formosa.</span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 border border-carbon-line p-2 sm:p-3 hover:border-ember">
                    <input
                      type="radio"
                      name="forma-entrega"
                      value="envio"
                      checked={formaEntrega === "envio"}
                      onChange={() => setFormaEntrega("envio")}
                      className="mt-1 accent-ember"
                    />
                    <span>
                      <span className="block text-sm font-medium">Envío a domicilio en Formosa</span>
                      <span className="mt-1 hidden text-xs text-bone-dim sm:block">Entregas en Formosa Capital.</span>
                    </span>
                  </label>
                </div>
              </fieldset>

              {formaEntrega === "envio" && (
                <div className="mb-2 border border-carbon-line p-2 sm:mb-4 sm:p-3">
                  <label htmlFor="checkout-direccion" className="mb-1 block text-sm">Dirección de entrega</label>
                  <input
                    id="checkout-direccion"
                    type="text"
                    required
                    maxLength={200}
                    value={direccionEntrega}
                    onChange={(event) => {
                      setDireccionEntrega(event.target.value);
                      setCotizacion(null);
                      setErrorEnvio(null);
                    }}
                    placeholder="Calle, altura y barrio"
                    className="w-full border border-carbon-line bg-carbon px-3 py-2 text-sm outline-none focus:border-ember"
                  />
                  <button
                    type="button"
                    onClick={handleCotizarEnvio}
                    disabled={cotizandoEnvio || !direccionEntrega.trim()}
                    className="mt-2 w-full border border-ember px-4 py-1.5 text-sm font-semibold text-ember hover:bg-ember/10 disabled:opacity-50"
                  >
                    {cotizandoEnvio ? "Calculando…" : "Ver costo de envío"}
                  </button>
                  {errorEnvio && <p role="alert" className="mt-2 text-sm text-ember">{errorEnvio}</p>}
                  <p className="mt-1 text-[10px] leading-tight text-bone-dim sm:text-[11px]">
                    Tu dirección se comparte y puede registrarse para cotizar. <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a> · rutas de <a className="underline" href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener noreferrer">FOSS GIS</a>.
                  </p>
                  <a
                    href="https://wa.me/5493704696533?text=Hola%2C%20quiero%20consultar%20un%20env%C3%ADo%20fuera%20del%20radio%20autom%C3%A1tico."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-block text-xs text-ember hover:text-ember-bright"
                  >
                    ¿Estás en otra zona? Consultanos
                  </a>
                  {cotizacion && (
                    <p className="mt-1 text-sm text-signal">
                      Envío: {formatearPrecio(cotizacion.costo_envio)}
                    </p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-x-2 sm:gap-x-3">
              <div className="col-span-2">
              <label htmlFor="checkout-nombre" className="mb-1 block text-xs sm:text-sm">Nombre y apellido</label>
              <input
                id="checkout-nombre"
                type="text"
                required
                maxLength={150}
                autoComplete="name"
                    value={nombreCheckout}
                    onChange={(event) => {
                      setNombre(event.target.value);
                      setNombreEditado(true);
                    }}
                className="mb-2 w-full border border-carbon-line bg-carbon px-2 py-1.5 text-sm outline-none focus:border-ember sm:mb-4 sm:px-3 sm:py-2"
              />
              </div>
              <div>
              <label htmlFor="checkout-telefono" className="mb-1 block text-xs sm:text-sm">Teléfono</label>
              <input
                id="checkout-telefono"
                type="tel"
                required
                maxLength={30}
                autoComplete="tel"
                value={telefono}
                onChange={(event) => setTelefono(event.target.value)}
                className="mb-2 w-full border border-carbon-line bg-carbon px-2 py-1.5 text-sm outline-none focus:border-ember sm:mb-4 sm:px-3 sm:py-2"
              />
              </div>
              <div>
              <label htmlFor="checkout-email" className="mb-1 block text-xs sm:text-sm">Email</label>
              <input
                id="checkout-email"
                type="email"
                required
                    value={emailCheckout}
                    onChange={(event) => {
                      setEmail(event.target.value);
                      setEmailEditado(true);
                    }}
                placeholder="tu@email.com"
                className="mb-2 w-full border border-carbon-line bg-carbon px-2 py-1.5 text-sm outline-none focus:border-ember sm:mb-4 sm:px-3 sm:py-2"
              />
              </div>
              </div>
              <fieldset className="mb-2 sm:mb-4">
                <legend className="mb-1 text-sm font-medium sm:mb-2">¿Cómo querés pagar?</legend>
                <div className="grid grid-cols-2 gap-2">
                  {mediosPago.map((medio) => (
                    <label
                      key={medio.id}
                      className={`border p-2 sm:p-3 ${medio.disponible ? "cursor-pointer border-carbon-line hover:border-ember" : "cursor-not-allowed border-carbon-line opacity-50"}`}
                    >
                      <span className="flex items-start gap-2">
                        <input
                          type="radio"
                          name="medio-pago"
                          value={medio.id}
                          checked={medioPago === medio.id}
                          disabled={!medio.disponible}
                          onChange={() => setMedioPago(medio.id)}
                          className="mt-1 accent-ember"
                        />
                        <span>
                          <span className="block text-sm font-medium">
                            {medio.id === "local" && formaEntrega === "envio" ? "Pagar en efectivo al recibir el envío" : medio.nombre}
                          </span>
                        </span>
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {/* El servidor vuelve a validar precio y stock al registrar el pedido. */}
              <div className="sticky bottom-0 -mx-3 -mb-3 mt-2 border-t border-carbon-line bg-carbon-raised px-3 pb-3 pt-2 sm:-mx-5 sm:-mb-5 sm:mt-4 sm:px-5 sm:pb-5">
                <div className="mb-2 space-y-0.5 text-sm sm:mb-3 sm:space-y-1">
                  <div className="flex items-center justify-between"><span>Productos</span><span>{formatearPrecio(subtotal)}</span></div>
                  <div className="flex items-center justify-between"><span>Envío</span><span>{formaEntrega === "retiro" ? "Gratis" : cotizacion ? formatearPrecio(costoEnvio) : "A calcular"}</span></div>
                  <div className="flex items-center justify-between border-t border-carbon-line pt-1 text-base font-semibold sm:pt-2 sm:text-lg"><span>Total</span><span>{formatearPrecio(total)}</span></div>
                </div>
                {error && <p role="alert" className="mb-3 border border-ember/40 bg-ember/10 p-3 text-sm text-ember">{error}</p>}
                <button
                  type="submit"
                  disabled={checkoutCargando || catalogoCargando || hayLineasSinCatalogo || hayStockInsuficiente}
                  className="w-full bg-ember px-6 py-2.5 text-sm font-semibold uppercase tracking-wide text-carbon transition-colors hover:bg-ember-bright disabled:cursor-not-allowed disabled:opacity-60 sm:py-3"
                >
                  {checkoutCargando
                    ? "Creando pedido…"
                    : medioPago === "mercado_pago"
                      ? "Continuar con Mercado Pago"
                      : medioPago === "transferencia"
                        ? "Confirmar pedido"
                        : formaEntrega === "envio"
                          ? "Confirmar pedido con envío"
                          : "Confirmar pedido"}
                </button>
              </div>
            </form>
          )}
        </div>
      </section>
    </div>,
    document.body
  );
}
