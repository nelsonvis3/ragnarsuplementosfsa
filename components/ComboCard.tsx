import Image from "next/image";
import Link from "next/link";

import type { Combo } from "@/types/producto";
const ars=(n:number)=>n.toLocaleString("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0});
export default function ComboCard({combo}:{combo:Combo}){
const total=combo.productos?.reduce((s,p)=>s+p.precio,0)??0;
const ahorro=Math.max(0,total-combo.precio);
const agotado=(combo.stock??0)<=0;
return <Link href={`/combos/${combo.slug}`} className="forge-product-tile group" aria-label={`Ver combo ${combo.nombre}`}>
<div className="forge-card-media relative aspect-[4/5] overflow-hidden rounded-md">
{ahorro>0&&<span className="absolute left-2.5 top-2.5 z-10 rounded-[4px] bg-ember px-2 py-1 text-xs font-extrabold text-white">Ahorrás {ars(ahorro)}</span>}
<Image src={combo.imagen} alt={combo.nombre} fill sizes="(min-width:1024px) 24vw,(min-width:640px) 45vw,50vw" className={`object-cover ${agotado?"opacity-50 grayscale":""}`}/>
{agotado&&<span className="absolute inset-x-0 bottom-0 bg-black/75 py-2 text-center text-xs font-bold uppercase tracking-wider text-white">Sin stock</span>}
</div>
<h3 className="mt-3 font-display text-[15px] font-extrabold uppercase leading-snug tracking-[-.01em] sm:text-base">{combo.nombre}</h3>
<p className="mt-1 text-[13px] text-bone-dim">Combo de {combo.productos?.length??combo.productosIds.length} productos</p>
<p className="mt-2 flex items-baseline gap-2"><strong className="font-display text-lg font-bold">{ars(combo.precio)}</strong>{ahorro>0&&<s className="text-sm text-bone-dim">{ars(total)}</s>}</p>
</Link>;
}
