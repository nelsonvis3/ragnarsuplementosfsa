import Image from "next/image";
import Link from "next/link";

import type { Producto } from "@/types/producto";
const ars=(n:number)=>n.toLocaleString("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0});
export const categoria=(slug:string)=>({proteinas:"Proteína",creatina:"Creatina","pre-entreno":"Pre-entreno",mass:"Ganador de masa",vitaminas:"Vitaminas",colageno:"Colágeno",alimentos:"Alimento proteico"} as Record<string,string>)[slug]??slug.replaceAll("-"," ");
/** Frameless card: the shop photo carries it, the type does the rest. */
export default function ProductoCard({producto}:{producto:Producto}){
const descuento=producto.precioAnterior && producto.precioAnterior>producto.precio ? Math.round((1-producto.precio/producto.precioAnterior)*100):0;
const sabores=producto.sabores?.length??0;
const agotado=producto.stock<=0;
return <Link href={`/productos/${producto.slug}`} className="forge-product-tile group" aria-label={`Ver ${producto.nombre}`}>
<div className="forge-card-media relative aspect-[4/5] overflow-hidden rounded-md">
{descuento>0&&<span className="absolute left-2.5 top-2.5 z-10 rounded-[4px] bg-ember px-2 py-1 text-xs font-extrabold text-white">-{descuento}%</span>}
{producto.esNuevo&&<span className="absolute right-2.5 top-2.5 z-10 rounded-[4px] bg-bone px-2 py-1 text-xs font-extrabold uppercase text-carbon">Nuevo</span>}
<Image src={producto.imagen} alt={producto.nombre} fill sizes="(min-width:1024px) 24vw,(min-width:640px) 45vw,50vw" className={`object-cover ${agotado?"opacity-50 grayscale":""}`} />
{agotado&&<span className="absolute inset-x-0 bottom-0 bg-black/75 py-2 text-center text-xs font-bold uppercase tracking-wider text-white">Sin stock</span>}
</div>
<h3 className="mt-3 font-display text-[15px] font-extrabold uppercase leading-snug tracking-[-.01em] sm:text-base">{producto.nombre}</h3>
<p className="mt-1 text-[13px] text-bone-dim">{categoria(producto.categoria)}{sabores>1?` · ${sabores} sabores`:""}</p>
<p className="mt-2 flex items-baseline gap-2"><strong className="font-display text-lg font-bold">{ars(producto.precio)}</strong>{descuento>0&&<s className="text-sm text-bone-dim">{ars(producto.precioAnterior!)}</s>}</p>
</Link>;
}
