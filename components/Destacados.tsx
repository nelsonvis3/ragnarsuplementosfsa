"use client";
import { useEffect,useState } from "react";
import Link from "next/link";

import ProductoCard from "@/components/ProductoCard";
import { listarDestacados } from "@/lib/api";
import type { Producto } from "@/types/producto";
export default function Destacados(){
const [productos,setProductos]=useState<Producto[]>([]);
const [error,setError]=useState(false);
useEffect(()=>{let activo=true;listarDestacados().then(res=>{if(activo)setProductos(res);}).catch(()=>{if(activo)setError(true);});return()=>{activo=false;};},[]);
return <section className="forge-section border-y border-carbon-line bg-carbon-raised/40"><div className="mx-auto max-w-7xl px-5 sm:px-8"><div className="mb-10 flex flex-wrap items-end justify-between gap-4"><div><span className="forge-eyebrow">SELECCIÓN RAGNAR</span><h2 className="forge-title mt-3 text-4xl sm:text-5xl">SUPLEMENTOS DESTACADOS.</h2><p className="mt-4 max-w-lg text-sm leading-6 text-bone-dim">Los más vendidos en nuestra tienda!</p></div><Link href="/productos" className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[.15em] text-ember hover:text-ember-bright">Todo el catálogo</Link></div>{productos.length>0?<div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">{productos.map(p=><ProductoCard key={p.id} producto={p}/>)}</div>:<p className="rounded-xl border border-carbon-line bg-carbon-raised px-6 py-10 text-center text-sm text-bone-dim">{error?"No pudimos cargar los productos en este momento.":"Los productos destacados aparecerán aquí cuando estén disponibles."}</p>}</div></section>;
}
