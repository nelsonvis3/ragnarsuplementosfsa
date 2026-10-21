"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { listarCombos } from "@/lib/api";
import type { Combo } from "@/types/producto";

export default function ForgeComboFeature() {
  const [combo, setCombo] = useState<Combo | null>(null);
  useEffect(() => {
    let mounted = true;
    listarCombos()
      .then((items) => { if (mounted) setCombo(items[0] ?? null); })
      .catch(() => { /* La pieza visual usa imagen local si la API está apagada. */ });
    return () => { mounted = false; };
  }, []);

  return (
    <section className="px-3 py-12 sm:px-6 sm:py-16 lg:px-8 xl:px-10" aria-labelledby="combos-destacados-titulo">
      <div className="forge-combo-feature relative isolate grid w-full overflow-hidden rounded-2xl border border-[#77313b] bg-[#160f14] lg:min-h-[510px] lg:grid-cols-[1.08fr_.92fr]">
        <div className="relative z-10 flex flex-col items-start justify-center px-6 pb-8 pt-12 sm:px-10 sm:py-14 lg:px-14 xl:px-20">
          <span className="text-[11px] font-bold uppercase tracking-[.18em] text-[#efa1ab]">
            COMBOS RAGNAR
          </span>
          <h2
            id="combos-destacados-titulo"
            className="mt-5 max-w-[13ch] font-display text-4xl font-extrabold uppercase leading-[1.08] tracking-[-.045em] text-[#f4f1ec] sm:text-5xl xl:text-6xl"
          >
            MÁS DISCIPLINA.<br />
            <span className="text-[#f04452]">MEJOR COMBINACIÓN.</span>
          </h2>
          <p className="mt-6 max-w-md text-sm leading-7 text-[#ccc0c3] sm:text-base">
            Proteínas, creatinas y más, en combinaciones pensadas para tu entrenamiento.
            Descubrí nuestros combos y elegí el tuyo.
          </p>
          <Link
            href="/combos"
            className="mt-8 inline-flex min-h-12 items-center justify-center rounded-lg bg-[#d62839] px-7 text-sm font-bold uppercase tracking-[.065em] text-white hover:bg-[#f04452]"
          >
            Explorar combos
          </Link>
        </div>
        <div className="forge-combo-visual relative min-h-[290px] sm:min-h-[360px] lg:min-h-[510px]">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_52%_52%,rgba(232,55,77,.32),transparent_65%)]" aria-hidden="true"/>
          <Image
            src={combo?.imagen || "/productos-img/combos/prote-creaone200gr.png"}
            alt={combo ? combo.nombre : "Combo de proteína y creatina Ragnar"}
            fill
            sizes="(min-width:1024px) 49vw, 95vw"
            className="forge-combo-product object-contain"
          />
        </div>
      </div>
    </section>
  );
}
