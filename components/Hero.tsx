"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";

interface Boton {
  texto: string;
  href: string;
  externo?: boolean;
}

interface Slide {
  imagen?: string;
  imagenMobile?: string;
  kicker?: string;
  titulo?: React.ReactNode;
  texto?: string;
  botones: Boton[];
  sinOverlay?: boolean;
}

const SLIDES: Slide[] = [
  {
    // Primer slide sin imagen, con el texto sobre el fondo oscuro.
    kicker: "Suplementación deportiva",
    titulo: (
      <>
        Elegí tu
        <br />
        <span className="text-ember">suplementación.</span>
      </>
    ),
    texto:
      "Proteínas, creatina y pre-entrenos. Consultá el rótulo de cada producto para ver su composición e indicaciones.",
    botones: [
      { texto: "Ver catálogo", href: "/productos" },
      {
        texto: "Hablanos por WhatsApp",
        href: "https://wa.me/5493704696533",
        externo: true,
      },
    ],
  },
  {
    imagen: "/hero-slides/slide-4-combos.png",
    imagenMobile: "/hero-slides/slide-4-combos-mobile.jpg",
    botones: [{ texto: "Ver productos", href: "/combos" }],
    sinOverlay: true,
  },
];

const INTERVALO_MS = 5000;

export default function Hero() {
  const [slideActivo, setSlideActivo] = useState(0);
  const [kickerVisible, setKickerVisible] = useState(false);

  useEffect(() => {
    const intervalo = setInterval(() => {
      setSlideActivo((actual) => (actual + 1) % SLIDES.length);
    }, INTERVALO_MS);

    return () => clearInterval(intervalo);
  }, []);

  useEffect(() => {
    const timeout = setTimeout(() => setKickerVisible(true), 100);
    return () => clearTimeout(timeout);
  }, []);

  return (
    <section className="relative min-h-[85vh] overflow-hidden border-b border-carbon-line bg-carbon">
      {SLIDES.map((slide, index) => {
        const activo = index === slideActivo;
        const posicion = activo
          ? "translate-x-0 opacity-100"
          : index < slideActivo
            ? "-translate-x-full opacity-0"
            : "translate-x-full opacity-0";

        return (
          <div
            key={index}
            aria-hidden={!activo}
            className={`absolute inset-0 overflow-hidden transition-[transform,opacity] duration-700 ease-in-out ${posicion} ${
              activo ? "pointer-events-auto" : "pointer-events-none"
            }`}
          >
            {slide.imagen && (
              <>
                {slide.imagenMobile ? (
                  <>
                    <Image
                      src={slide.imagen}
                      alt=""
                      fill
                      priority
                      sizes="100vw"
                      className="hidden object-cover md:block"
                    />
                    <div className="absolute inset-x-0 top-0 bottom-20 bg-carbon md:hidden">
                      <Image
                        src={slide.imagenMobile}
                        alt="Promoción de combos Ragnar Suplementos"
                        fill
                        priority
                        sizes="(max-width: 767px) 100vw, 1px"
                        className="object-contain object-center"
                      />
                    </div>
                  </>
                ) : (
                  <Image
                    src={slide.imagen}
                    alt=""
                    fill
                    priority
                    sizes="100vw"
                    className="object-cover"
                  />
                )}
              </>
            )}

            {!slide.sinOverlay && (
              <div className="absolute inset-0 bg-carbon/70" />
            )}

            {slide.titulo ? (
              <div className="relative z-10 flex min-h-[85vh] flex-col items-center justify-center px-5 text-center">
                {slide.kicker && (
                  <span
                    className={`text-xs font-medium uppercase tracking-[0.3em] text-ember transition-opacity duration-1000 ${
                      kickerVisible ? "opacity-100" : "opacity-0"
                    }`}
                  >
                    {slide.kicker}
                  </span>
                )}

                <h1 className="mt-4 font-display text-5xl font-semibold leading-[1.05] tracking-tight sm:text-6xl lg:text-7xl">
                  {slide.titulo}
                </h1>

                {slide.texto && (
                  <p className="mx-auto mt-6 max-w-md text-base text-bone-dim">
                    {slide.texto}
                  </p>
                )}

                <div className="mt-8 flex flex-wrap justify-center gap-4">
                  {slide.botones.map((boton) =>
                    boton.externo ? (
                      <Link
                        key={boton.texto}
                        href={boton.href}
                        target="_blank"
                        rel="noopener"
                        className="border border-bone px-7 py-3 text-sm font-semibold uppercase tracking-wide transition-colors hover:border-ember hover:text-ember"
                      >
                        {boton.texto}
                      </Link>
                    ) : (
                      <Link
                        key={boton.texto}
                        href={boton.href}
                        className="bg-ember px-7 py-3 text-sm font-semibold uppercase tracking-wide text-carbon transition-colors hover:bg-ember-bright"
                      >
                        {boton.texto}
                      </Link>
                    )
                  )}
                </div>
              </div>
            ) : (
              <div className="absolute inset-x-0 bottom-16 z-10 flex justify-center px-5">
                {slide.botones.map((boton) => (
                  <Link
                    key={boton.texto}
                    href={boton.href}
                    className="animate-bounce-in bg-ember px-7 py-3 text-center text-sm font-semibold uppercase tracking-wide text-carbon transition-colors hover:bg-ember-bright"
                  >
                    {boton.texto}
                  </Link>
                ))}
              </div>
            )}
          </div>
        );
      })}

      <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 gap-2">
        {SLIDES.map((_, index) => (
          <button
            key={index}
            onClick={() => setSlideActivo(index)}
            aria-label={`Ir al slide ${index + 1}`}
            aria-current={index === slideActivo ? "true" : undefined}
            className={`h-1.5 w-8 transition-colors ${
              index === slideActivo ? "bg-ember" : "bg-bone/30"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
