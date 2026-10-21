import Image from "next/image";
import Link from "next/link";

import type { Producto } from "@/types/producto";
const ars=(n:number)=>n.toLocaleString("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0});
export default function ProductoCard({producto}:{producto:Producto}){
const descuento=producto.precioAnterior && producto.precioAnterior>producto.precio ? Math.round((1-producto.precio/producto.precioAnterior)*100):0;
return <Link href={`/productos/${producto.slug}`} className="forge-card group" aria-label={`Ver ${producto.nombre}`}>
<div className="forge-card-media relative aspect-[1/1.06] overflow-hidden p-5">
<div className="absolute left-3 top-3 z-10 flex flex-col gap-1.5">
{descuento>0&&<span className="w-fit rounded-md bg-ember px-2.5 py-1 text-[10px] font-extrabold tracking-wider text-white">-{descuento}%</span>}
{producto.esNuevo&&<span className="w-fit rounded-md border border-carbon-line bg-carbon-raised px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wider">NUEVO</span>}
</div><Image src={producto.imagen} alt={producto.nombre} fill sizes="(min-width:1024px) 24vw,(min-width:640px) 45vw,50vw" className="object-contain p-7 sm:p-9" />
</div>
<div className="flex flex-1 flex-col border-t border-carbon-line p-4 sm:p-5">
<span className="forge-label">{producto.categoria.replaceAll("-"," ")}</span>
<h3 className="mt-2 min-h-[2.75rem] font-display text-sm font-bold leading-snug tracking-tight sm:text-base">{producto.nombre}</h3>
<div className="mt-auto flex items-end justify-between gap-2 pt-5">
<div><p className="text-[10px] uppercase tracking-widest text-bone-dim">{producto.stock>0?"Disponible":"Sin stock"}</p><strong className="mt-1 block font-display text-lg font-bold sm:text-xl">{ars(producto.precio)}</strong>{descuento>0&&<span className="text-xs text-bone-dim line-through">{ars(producto.precioAnterior!)}</span>}</div>

</div></div></Link>;
}