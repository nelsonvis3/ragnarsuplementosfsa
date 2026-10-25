import Image from "next/image";
import Link from "next/link";

const categories = [
  {
    name: "GANAR MÚSCULO",
    description: "Proteínas para recuperar y crecer",
    href: "/productos?categoria=proteinas",
    image: "/productos-img/proteinas/proteina-onefit/proteina-onefit-907gr.png",
  },
  {
    name: "MÁS FUERZA",
    description: "Creatina para rendir en cada serie",
    href: "/productos?categoria=creatina",
    image: "/productos-img/creatinas/creatina-star/creatinastar.png",
  },
  {
    name: "ENERGÍA PARA ENTRENAR",
    description: "Pre-entrenos para llegar con todo",
    href: "/productos?categoria=pre-entreno",
    image: "/productos-img/pre-entrenos/pre-onefit300g-uva.png",
  },
  {
    name: "SUBIR DE PESO",
    description: "Ganadores de masa con calorías extra",
    href: "/productos?categoria=mass",
    image: "/productos-img/ganador-de-masa/mutantmass.png",
  },
]

export default function ForgeCategories() {
  return (
    <section className="forge-section mx-auto max-w-7xl px-5 sm:px-8" aria-labelledby="categorias-titulo">
      <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="forge-eyebrow">SEGÚN TU OBJETIVO</span>
          <h2 id="categorias-titulo" className="forge-title mt-3 text-3xl sm:text-4xl lg:text-5xl">
            ¿QUÉ ESTÁS BUSCANDO?
          </h2>
        </div>
        <p className="max-w-xs text-sm leading-6 text-bone-dim">
          Elegí tu objetivo y te mostramos los productos que sirven para eso.
        </p>
      </div>
      <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
        {categories.map((category) => (
          <Link
            href={category.href}
            key={category.href}
            className="forge-category-card group"
            aria-label={`Explorar ${category.name.toLowerCase()}`}
          >
            <div className="forge-category-media relative aspect-[4/3] overflow-hidden">
              <Image
                src={category.image}
                alt={category.name}
                fill
                sizes="(min-width:1024px) 24vw, (min-width:640px) 45vw, 47vw"
                className="forge-category-photo object-cover"
              />
            </div>
            <div className="forge-category-copy flex flex-1 flex-col justify-center border-t border-carbon-line px-3 py-4 sm:px-5 sm:py-5">
              <h3 className="font-display text-[16px] font-bold uppercase leading-tight tracking-[-.025em] sm:text-[20px]">
                {category.name}
              </h3>
              <p className="mt-1 text-[11px] leading-4 text-bone-dim sm:text-xs sm:leading-5">
                {category.description}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
