import Image from "next/image";
import Link from "next/link";
import { Star } from "lucide-react";
import { Producto } from "@/types/producto";
import AdvertenciaSuplemento from "@/components/AdvertenciaSuplemento";

function formatearPrecio(valor: number) {
  return `$${valor.toLocaleString("es-AR")}`;
}

export default function ProductoCard({ producto }: { producto: Producto }) {
  const tieneDescuento =
    producto.precioAnterior && producto.precioAnterior > producto.precio;

  const porcentajeDescuento = tieneDescuento
    ? Math.round(
        ((producto.precioAnterior! - producto.precio) /
          producto.precioAnterior!) *
          100
      )
    : 0;

  return (
    <Link
      href={`/productos/${producto.slug}`}
      className="group block border border-carbon-line bg-carbon-raised transition-colors hover:border-ember"
    >
      <div className="relative aspect-square overflow-hidden bg-carbon p-6">
        {/* Badge automático: nuevo o descuento */}
        {producto.esNuevo && (
          <span className="absolute left-3 top-3 z-10 bg-ember px-2 py-1 text-xs font-semibold uppercase tracking-wide text-carbon">
            Nuevo
          </span>
        )}
        {tieneDescuento && (
          <span className="absolute left-3 top-3 z-10 bg-ember px-2 py-1 text-xs font-semibold uppercase tracking-wide text-carbon">
            -{porcentajeDescuento}%
          </span>
        )}

        <Image
          src={producto.imagen}
          alt={producto.nombre}
          fill
          className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        />
      </div>

      <div className="border-t border-carbon-line p-4">
        <span className="text-xs uppercase tracking-wide text-ember">
          {producto.categoria.replace("-", " ")}
        </span>

        <h3 className="mt-1 font-display text-base font-medium leading-tight transition-colors group-hover:text-ember">
          {producto.nombre}
        </h3>

        {producto.rating !== undefined && (
          <div className="mt-2 flex items-center gap-1">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                size={14}
                className={
                  i < Math.round(producto.rating!)
                    ? "fill-ember text-ember"
                    : "text-carbon-line"
                }
              />
            ))}
          </div>
        )}

        <div className="mt-3 flex items-center justify-between">
          <div className="flex items-baseline gap-2">
            <span className="text-lg font-semibold">
              {formatearPrecio(producto.precio)}
            </span>
            {tieneDescuento && (
              <span className="text-sm text-bone-dim line-through">
                {formatearPrecio(producto.precioAnterior!)}
              </span>
            )}
          </div>
        </div>
        {producto.categoria !== "alimentos" && <AdvertenciaSuplemento compact />}
      </div>
    </Link>
  );
}
