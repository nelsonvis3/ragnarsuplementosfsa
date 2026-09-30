import { ShieldCheck, Truck, MessageCircle } from "lucide-react";

const FEATURES = [
  {
    icon: ShieldCheck,
    titulo: "Garantía de calidad",
    descripcion: "Productos originales, verificados antes de cada envío.",
  },
  {
    icon: Truck,
    titulo: "Envíos en Formosa Capital",
    descripcion: "Calculamos la tarifa por ruta. Para zonas más alejadas, consultanos por WhatsApp.",
  },
  {
    icon: MessageCircle,
    titulo: "Asesoramiento real",
    descripcion: "Te ayudamos a elegir según tu objetivo, sin vueltas.",
  },
];

export default function Features() {
  return (
    <section className="border-b border-carbon-line">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-16 sm:grid-cols-3">
        {FEATURES.map(({ icon: Icon, titulo, descripcion }) => (
          <div key={titulo} className="flex flex-col items-start gap-3">
            <Icon className="text-ember" size={28} strokeWidth={1.5} />
            <h3 className="font-display text-lg font-semibold">{titulo}</h3>
            <p className="text-sm text-bone-dim">{descripcion}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
