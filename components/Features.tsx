import { Headphones, MapPinned, ShieldCheck } from "lucide-react";
const features=[
  {Icon:ShieldCheck,title:"CALIDAD SIN VUELTAS",text:"Productos originales y un catálogo seleccionado."},
  {Icon:MapPinned,title:"DEL LOCAL A TU PUERTA",text:"Retiro en tienda y envíos en Formosa Capital."},
  {Icon:Headphones,title:"ASESORAMIENTO REAL",text:"¿Tenés dudas? Escribinos y encontrá tu opción."}
];
export default function Features(){return <section className="border-b border-carbon-line bg-carbon-raised"><div className="mx-auto grid max-w-7xl gap-0 px-5 sm:px-8 md:grid-cols-3">{features.map(({Icon,title,text})=><div key={title} className="flex items-start gap-4 border-b border-carbon-line py-8 md:border-b-0 md:border-r md:px-7 md:first:pl-0 md:last:border-r-0 md:last:pr-0"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-ember/10 text-ember"><Icon size={22}/></span><div><h2 className="font-display text-sm font-bold tracking-[.08em]">{title}</h2><p className="mt-1.5 text-sm leading-6 text-bone-dim">{text}</p></div></div>)}</div></section>}