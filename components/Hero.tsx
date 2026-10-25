import Image from "next/image";
import Link from "next/link";

export default function Hero() {
  return (
    <section className="forge-hero" aria-labelledby="hero-title">
      <div className="relative mx-auto grid min-h-[620px] max-w-7xl items-center gap-4 px-5 pb-8 pt-8 sm:px-8 lg:grid-cols-[1.05fr_.95fr] lg:gap-0 lg:pb-14 lg:pt-10">
        <div className="relative z-20 max-w-2xl">
          <span className="inline-flex items-center gap-2 border-l-2 border-ember pl-3 text-[11px] font-bold uppercase tracking-[.26em] text-[#e0a3a9]">
            Suplementación deportiva · Formosa
          </span>
          <h1 id="hero-title" className="mt-5 font-display text-[clamp(3.35rem,6.7vw,7.3rem)] font-extrabold uppercase leading-[.95] tracking-[-.035em]">
            LA FUERZA <span className="mt-1 block text-[.78em] tracking-[-.03em] text-[#e83b4b]">SE CONSTRUYE.</span>
          </h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-[#c1b9ba] sm:text-lg">
            Proteínas, creatinas, pre-entrenos y combos, con el precio y el stock del local.
          </p>
          <div className="mt-9 flex flex-wrap items-center gap-3">
            <Link href="/productos" className="inline-flex min-h-14 items-center justify-center gap-3 rounded-lg bg-[#d62839] px-7 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#f04452]">
              Explorar catálogo
            </Link>
            <Link href="/combos" className="inline-flex min-h-14 items-center justify-center gap-2 rounded-lg border border-white/30 px-6 text-sm font-semibold uppercase tracking-wider text-white hover:border-[#f04452]">
              Ver combos
            </Link>
          </div>
        </div>
        <div className="forge-hero-art z-10 flex items-center justify-center lg:translate-x-6" aria-label="Suplementos deportivos">
          <div className="forge-hero-glow" />
          <div className="forge-hero-orbit" />
          <div className="relative z-10 h-[300px] w-[65%] max-w-[450px] sm:h-[420px] lg:h-[520px]">
            <Image src="/productos-img/proteinas/proteina-onefit/proteina-onefit-907gr.png" alt="Proteína disponible en Ragnar Suplementos" fill priority sizes="(max-width: 1024px) 70vw, 35vw" className="object-contain drop-shadow-[0_45px_35px_rgba(0,0,0,.75)]"/>
          </div>
          <div className="absolute bottom-0 right-0 z-20 h-[170px] w-[37%] sm:bottom-[2%] sm:h-[240px]">
            <Image src="/productos-img/creatinas/creatina-star/creatinastar.png" alt="Creatina disponible en Ragnar Suplementos" fill sizes="(max-width: 1024px) 28vw, 16vw" className="object-contain drop-shadow-[0_25px_28px_rgba(0,0,0,.8)]"/>
          </div>

        </div>
      </div>
    </section>
  );
}
