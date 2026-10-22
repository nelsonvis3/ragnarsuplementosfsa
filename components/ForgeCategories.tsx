import Image from "next/image";
import Link from "next/link";

const categories = [
  {
    name: "PROTEÍNAS",
    description: "Nutrición para tu entrenamiento",
    href: "/productos?categoria=proteinas",
    image: "/productos-img/proteinas/proteina-onefit/proteina-onefit-907gr.png",
  },
  {
    name: "CREATINAS",
    description: "Constancia y rendimiento",
    href: "/productos?categoria=creatina",
    image: "/productos-img/creatinas/creatina-star/creatinastar.png",
  },
  {
    name: "PRE-ENTRENOS",
    description: "Prepará cada sesión",
    href: "/productos?categoria=pre-entreno",
    image: "/productos-img/pre-entrenos/pre-onefit300g-uva.png",
  },
  {
    name: "COMBOS",
    description: "Tu selección, mejor combinada",
    href: "/combos",
    image: "/productos-img/combos/prote-creaone200gr.png",
  },
];

export default function ForgeCategories() {
  return (
    <section className="forge-section mx-auto max-w-7xl px-5 sm:px-8" aria-labelledby="categorias-titulo">
      <div className="mb-9 flex flex-wrap items-end justify-between gap-4">
        <div>
          <span className="forge-eyebrow">EXPLORÁ RAGNAR</span>
          <h2 id="categorias-titulo" className="forge-title mt-3 text-3xl sm:text-4xl lg:text-5xl">
            ENTRENÁ A TU MANERA.
          </h2>
        </div>
        <p className="max-w-xs text-sm leading-6 text-bone-dim">
          Elegí una categoría y encontrá lo que necesitás para tu rutina.
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
            <div className="forge-category-media relative h-[158px] overflow-hidden sm:h-[200px] lg:h-[185px] xl:h-[200px]">
              <Image
                src={category.image}
                alt={category.name}
                fill
                sizes="(min-width:1024px) 24vw, (min-width:640px) 45vw, 47vw"
                className="forge-category-photo object-contain p-3 sm:p-4 lg:p-5"
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
