import Image from "next/image";
import Link from "next/link";
import type { Combo } from "@/types/producto";
import AdvertenciaSuplemento from "@/components/AdvertenciaSuplemento";

function formatearPrecio(valor: number) {
  return `$${valor.toLocaleString("es-AR")}`;
}

export default function ComboCard({ combo }: { combo: Combo }) {
  const precioSumado = combo.productos?.reduce((total, producto) => total + producto.precio, 0) ?? 0;
  const ahorro = Math.max(0, precioSumado - combo.precio);

  return (
    <Link
      href={`/combos/${combo.slug}`}
      className="group block border border-carbon-line bg-carbon-raised transition-colors hover:border-ember"
    >
      <div className="relative aspect-square overflow-hidden bg-carbon p-6">
        {ahorro > 0 && (
          <span className="absolute left-3 top-3 z-10 bg-ember px-2 py-1 text-xs font-semibold uppercase tracking-wide text-carbon">
            Ahorrás {formatearPrecio(ahorro)}
          </span>
        )}

        <Image
          src={combo.imagen}
          alt={combo.nombre}
          fill
          className="object-contain p-4 transition-transform duration-300 group-hover:scale-105"
          sizes="(min-width: 1024px) 25vw, (min-width: 640px) 33vw, 50vw"
        />
      </div>

      <div className="border-t border-carbon-line p-4">
        <span className="text-xs uppercase tracking-wide text-ember">
          Combo
        </span>
        <h3 className="mt-1 font-display text-base font-medium leading-tight transition-colors group-hover:text-ember">
          {combo.nombre}
        </h3>

        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-lg font-semibold">
            {formatearPrecio(combo.precio)}
          </span>
          {ahorro > 0 && (
            <span className="text-sm text-bone-dim line-through">
              {formatearPrecio(precioSumado)}
            </span>
          )}
        </div>
        <AdvertenciaSuplemento compact />
      </div>
    </Link>
  );
}
