import Image from "next/image";
import Link from "next/link";

import type { Combo } from "@/types/producto";
const ars=(n:number)=>n.toLocaleString("es-AR",{style:"currency",currency:"ARS",maximumFractionDigits:0});
export default function ComboCard({combo}:{combo:Combo}){
const total=combo.productos?.reduce((s,p)=>s+p.precio,0)??0;
const ahorro=Math.max(0,total-combo.precio);
return <Link href={`/combos/${combo.slug}`} className="forge-card group" aria-label={`Ver combo ${combo.nombre}`}>
<div className="forge-card-media relative aspect-[1/1.06] overflow-hidden"><span className="absolute left-3 top-3 z-10 rounded-md bg-ember px-2.5 py-1 text-[10px] font-bold tracking-wider text-white">COMBO RAGNAR</span>
<Image src={combo.imagen} alt={combo.nombre} fill sizes="(min-width:1024px) 24vw,(min-width:640px) 45vw,50vw" className="object-contain p-7 sm:p-9"/></div>
<div className="flex flex-1 flex-col border-t border-carbon-line p-4 sm:p-5"><span className="forge-label">PACKS / COMBOS</span><h3 className="mt-2 min-h-[2.75rem] font-display text-sm font-bold leading-snug sm:text-base">{combo.nombre}</h3>
{ahorro>0&&<p className="mt-2 text-xs font-semibold text-signal">Ahorrás {ars(ahorro)}</p>}
<div className="mt-auto flex items-end justify-between gap-2 pt-5"><div><p className="text-[10px] uppercase tracking-widest text-bone-dim">{(combo.stock??0)>0?"Disponible":"Sin stock"}</p><strong className="mt-1 block font-display text-lg font-bold sm:text-xl">{ars(combo.precio)}</strong>{ahorro>0&&<span className="text-xs text-bone-dim line-through">{ars(total)}</span>}</div></div></div></Link>;
}