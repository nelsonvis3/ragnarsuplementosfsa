"use client";

import { createPortal } from "react-dom";
import Image from "next/image";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { X, Minus, Plus, Trash2 } from "lucide-react";
import { useCartStore } from "@/store/cart-store";
import { useAuthStore } from "@/store/auth-store";
import { cotizarEnvio, crearPreferencia, listarCombos, listarMediosPago, listarProductos } from "@/lib/api";
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
  // Lógica interna: Django calcula la ruta, aplica los tramos configurados en backend/.env
  // (1 km gratis; luego $1.000, $2.500, $3.500 y $5.000 hasta 12 km) y firma la cotización por 15 minutos.
  const [cotizandoEnvio, setCotizandoEnvio] = useState(false);
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [email, setEmail] = useState("");
  const [checkoutCargando, setCheckoutCargando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const catalogoCargando = abierto && !catalogoListo;

  useEffect(() => {
    if (usuario?.email) setEmail((actual) => actual || usuario.email);
    if (usuario?.nombre_completo) setNombre((actual) => actual || usuario.nombre_completo);
  }, [usuario?.email, usuario?.nombre_completo]);

  useEffect(() => {
    if (!abierto) return;
    let vigente = true;
    setCatalogoListo(false);
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

  useEffect(() => {
    if (!abierto) {
      setPedidoManual(null);
      setError(null);
    }
  }, [abierto]);

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
  const mensajeWhatsapp = pedidoManual
    ? pedidoManual.medio_pago === "transferencia"
      ? `Hola, realicé la transferencia del pedido #${pedidoManual.pedido_id} por ${formatearPrecio(pedidoManual.total)}. Adjunto el comprobante.`
      : pedidoManual.forma_entrega === "envio"
        ? `Hola, quiero coordinar la entrega a domicilio del pedido #${pedidoManual.pedido_id} por ${formatearPrecio(pedidoManual.total)}.`
        : `Hola, quiero coordinar el pago y retiro del pedido #${pedidoManual.pedido_id} por ${formatearPrecio(pedidoManual.total)}.`
    : "";
  const whatsappPedidoUrl = `https://wa.me/5493704696533?text=${encodeURIComponent(mensajeWhatsapp)}`;

  async function handleCotizarEnvio() {
    if (!direccionEntrega.trim()) {
      setError("Escribí la calle, altura y barrio para calcular el envío.");
      return;
    }
    setCotizandoEnvio(true);
    setError(null);
    try {
      const resultado = await cotizarEnvio(direccionEntrega.trim());
      setCotizacion(resultado);
    } catch (err) {
      setCotizacion(null);
      setError(err instanceof Error ? err.message : "No pudimos calcular el envío.");
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
      const resultado = await crearPreferencia(lineas, nombre.trim(), telefono.trim(), email.trim(), medioPago, token, {
        forma: formaEntrega,
        ...(formaEntrega === "envio"
          ? { direccion: direccionEntrega.trim(), cotizacionEnvio: cotizacion?.cotizacion_envio }
          : {}),
      });
      if (resultado.tipo === "manual") {
        setPedidoManual(resultado);
        useCartStore.getState().vaciarCarrito();
        setCheckoutCargando(false);
        return;
      }
      if (!resultado.init_point) throw new Error("Mercado Pago no devolvió el enlace de pago.");
      window.location.assign(resultado.init_point);
    } catch (err) {
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
        onClick={onCerrar}
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
          <button type="button" aria-label="Cerrar carrito" onClick={onCerrar} className="p-1 hover:text-ember">
            <X size={22} />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col md:grid md:grid-cols-[minmax(0,1fr)_minmax(340px,420px)]">
          <section className={`min-h-0 overflow-y-auto border-b border-carbon-line p-4 sm:p-5 md:border-b-0 md:border-r ${!carritoVacio && !pedidoManual ? "max-h-[34dvh] shrink-0 md:max-h-none md:shrink" : "flex-1"}`}>
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
              <div className="flex flex-col gap-5">
                {combosConDatos.map((combo) => (
                  <div key={`combo-${combo.comboId}`} className="flex gap-3 border-b border-carbon-line pb-5">
                    <div className="relative h-16 w-16 shrink-0 bg-carbon">
                      <Image src={combo.imagen} alt={combo.nombre} fill className="object-contain p-1" />
                    </div>
                    <div className="flex-1">
                      <span className="text-[10px] uppercase tracking-wide text-ember">Combo</span>
                      <p className="text-sm font-medium">{combo.nombre}</p>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex items-center border border-carbon-line">
                          <button onClick={() => actualizarCantidadCombo(combo.comboId, -1)} className="p-1.5 text-bone-dim hover:text-ember" aria-label="Restar"><Minus size={12} /></button>
                          <span className="w-6 text-center text-xs">{combo.cantidad}</span>
                          <button onClick={() => actualizarCantidadCombo(combo.comboId, 1)} className="p-1.5 text-bone-dim hover:text-ember" aria-label="Sumar"><Plus size={12} /></button>
                        </div>
                        <button onClick={() => eliminarCombo(combo.comboId)} aria-label="Eliminar combo" className="text-bone-dim hover:text-ember"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <span className="text-sm font-semibold">{formatearPrecio(combo.precio * combo.cantidad)}</span>
                  </div>
                ))}

                {itemsConDatos.map((item) => (
                  <div key={`${item.productoId}-${item.sabor ?? "default"}`} className="flex gap-3 border-b border-carbon-line pb-5">
                    <div className="relative h-16 w-16 shrink-0 bg-carbon">
                      <Image src={item.imagen} alt={item.nombre} fill className="object-contain p-1" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.nombre}</p>
                      {item.sabor && <p className="text-xs text-bone-dim">Sabor: {item.sabor}</p>}
                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex items-center border border-carbon-line">
                          <button onClick={() => actualizarCantidad(item.productoId, item.sabor, -1)} className="p-1.5 text-bone-dim hover:text-ember" aria-label="Restar"><Minus size={12} /></button>
                          <span className="w-6 text-center text-xs">{item.cantidad}</span>
                          <button onClick={() => actualizarCantidad(item.productoId, item.sabor, 1)} className="p-1.5 text-bone-dim hover:text-ember" aria-label="Sumar"><Plus size={12} /></button>
                        </div>
                        <button onClick={() => eliminarItem(item.productoId, item.sabor)} aria-label="Eliminar producto" className="text-bone-dim hover:text-ember"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <span className="text-sm font-semibold">{formatearPrecio(item.precio * item.cantidad)}</span>
                  </div>
                ))}
                {hayLineasSinCatalogo && <p className="text-sm text-ember">Hay productos desactualizados en tu carrito.</p>}
              </div>
            )}
          </section>

          {!pedidoManual && !carritoVacio && (
            <form onSubmit={handleFinalizarCompra} className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 sm:p-5">
              <fieldset className="mb-4">
                <legend className="mb-2 text-sm font-medium">¿Cómo querés recibirlo?</legend>
                <div className="flex flex-col gap-2">
                  <label className="flex cursor-pointer items-start gap-2 border border-carbon-line p-3 hover:border-ember">
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
                      <span className="mt-1 block text-xs text-bone-dim">Azcuénaga 991, Formosa.</span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-2 border border-carbon-line p-3 hover:border-ember">
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
                      <span className="mt-1 block text-xs text-bone-dim">Entregas en Formosa Capital.</span>
                    </span>
                  </label>
                </div>
              </fieldset>

              {formaEntrega === "envio" && (
                <div className="mb-4 border border-carbon-line p-3">
                  <label htmlFor="checkout-direccion" className="mb-2 block text-sm">Dirección de entrega</label>
                  <input
                    id="checkout-direccion"
                    type="text"
                    required
                    maxLength={200}
                    value={direccionEntrega}
                    onChange={(event) => {
                      setDireccionEntrega(event.target.value);
                      setCotizacion(null);
                    }}
                    placeholder="Calle, altura y barrio"
                    className="w-full border border-carbon-line bg-carbon px-3 py-2 text-sm outline-none focus:border-ember"
                  />
                  <button
                    type="button"
                    onClick={handleCotizarEnvio}
                    disabled={cotizandoEnvio || !direccionEntrega.trim()}
                    className="mt-3 w-full border border-ember px-4 py-2 text-sm font-semibold text-ember hover:bg-ember/10 disabled:opacity-50"
                  >
                    {cotizandoEnvio ? "Calculando…" : "Ver costo de envío"}
                  </button>
                  <p className="mt-2 text-[11px] text-bone-dim">
                    Tu dirección se comparte y puede registrarse para cotizar. <a className="underline" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap</a> · rutas de <a className="underline" href="https://routing.openstreetmap.de/about.html" target="_blank" rel="noopener noreferrer">FOSS GIS</a>.
                  </p>
                  <a
                    href="https://wa.me/5493704696533?text=Hola%2C%20quiero%20consultar%20un%20env%C3%ADo%20fuera%20del%20radio%20autom%C3%A1tico."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 inline-block text-xs text-ember hover:text-ember-bright"
                  >
                    ¿Estás en otra zona? Consultanos
                  </a>
                  {cotizacion && (
                    <p className="mt-3 text-sm text-signal">
                      Envío: {formatearPrecio(cotizacion.costo_envio)}
                    </p>
                  )}
                </div>
              )}

              <label htmlFor="checkout-nombre" className="mb-2 block text-sm">Nombre y apellido</label>
              <input
                id="checkout-nombre"
                type="text"
                required
                maxLength={150}
                autoComplete="name"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                className="mb-4 w-full border border-carbon-line bg-carbon px-3 py-2 text-sm outline-none focus:border-ember"
              />
              <label htmlFor="checkout-telefono" className="mb-2 block text-sm">Teléfono</label>
              <input
                id="checkout-telefono"
                type="tel"
                required
                maxLength={30}
                autoComplete="tel"
                value={telefono}
                onChange={(event) => setTelefono(event.target.value)}
                className="mb-4 w-full border border-carbon-line bg-carbon px-3 py-2 text-sm outline-none focus:border-ember"
              />
              <label htmlFor="checkout-email" className="mb-2 block text-sm">Email</label>
              <input
                id="checkout-email"
                type="email"
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="tu@email.com"
                className="mb-4 w-full border border-carbon-line bg-carbon px-3 py-2 text-sm outline-none focus:border-ember"
              />
              <fieldset className="mb-4">
                <legend className="mb-2 text-sm font-medium">¿Cómo querés pagar?</legend>
                <div className="flex flex-col gap-2">
                  {mediosPago.map((medio) => (
                    <label
                      key={medio.id}
                      className={`border p-3 ${medio.disponible ? "cursor-pointer border-carbon-line hover:border-ember" : "cursor-not-allowed border-carbon-line opacity-50"}`}
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
              <div className="sticky bottom-0 -mx-4 -mb-4 mt-4 border-t border-carbon-line bg-carbon-raised px-4 pb-4 pt-3 sm:-mx-5 sm:-mb-5 sm:px-5 sm:pb-5">
                <div className="mb-3 space-y-1 text-sm">
                  <div className="flex items-center justify-between"><span>Productos</span><span>{formatearPrecio(subtotal)}</span></div>
                  <div className="flex items-center justify-between"><span>Envío</span><span>{formaEntrega === "retiro" ? "Gratis" : cotizacion ? formatearPrecio(costoEnvio) : "A calcular"}</span></div>
                  <div className="flex items-center justify-between border-t border-carbon-line pt-2 text-lg font-semibold"><span>Total</span><span>{formatearPrecio(total)}</span></div>
                </div>
                {error && <p role="alert" className="mb-3 border border-ember/40 bg-ember/10 p-3 text-sm text-ember">{error}</p>}
                <button
                  type="submit"
                  disabled={checkoutCargando || catalogoCargando || hayLineasSinCatalogo}
                  className="w-full bg-ember px-6 py-3 text-sm font-semibold uppercase tracking-wide text-carbon transition-colors hover:bg-ember-bright disabled:cursor-not-allowed disabled:opacity-60"
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
