import Link from "next/link";
import { Mail, MapPin } from "lucide-react";
import Logo from "@/components/Logo";
import { IconoMarca } from "@/components/IconosMarca";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-carbon-line bg-carbon-raised">
      <div className="mx-auto grid max-w-7xl gap-10 px-5 py-20 sm:grid-cols-2 sm:px-8 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            <Logo width={32} height={52} className="h-8 w-auto" />
            <span className="font-display text-xl font-bold tracking-tight">
              RAGNAR
            </span>
          </div>
          <p className="mt-3 text-sm text-bone-dim">La fuerza se construye. Rendimiento real, sin vueltas.</p>
        </div>

        <div id="contacto" className="scroll-mt-24">
          <h4 className="font-display text-sm font-semibold uppercase tracking-wide text-bone-dim">
            Contacto
          </h4>
          <div className="mt-3 flex flex-col gap-2">
            <Link
              href="https://wa.me/5493704696533"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-sm text-bone-dim transition-colors hover:text-ember"
            >
              <IconoMarca marca="whatsapp" />
              +54 9 3704 696533
            </Link>
            <Link
              href="mailto:adansiv16@gmail.com"
              className="flex items-center gap-2 text-sm text-bone-dim transition-colors hover:text-ember"
            >
              <Mail size={16} />
              adansiv16@gmail.com
            </Link>
            <Link
              href="https://instagram.com/ragnarsuplementos_fsa"
              target="_blank"
              rel="noopener"
              className="flex items-center gap-2 text-sm text-bone-dim transition-colors hover:text-ember"
            >
              <IconoMarca marca="instagram" />
              @ragnarsuplementos_fsa
            </Link>
          </div>
        </div>

        <div>
          <h4 className="font-display text-sm font-semibold uppercase tracking-wide text-bone-dim">
            Ubicación
          </h4>
          <div className="mt-3 flex items-start gap-2 text-sm text-bone-dim">
            <MapPin size={16} className="mt-0.5 shrink-0" />
            <span>Azcuénaga 991, Formosa Capital</span>
          </div>
        </div>

        <div>
          <h4 className="font-display text-sm font-semibold uppercase tracking-wide text-bone-dim">
            Atención y datos
          </h4>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <Link href="/atencion?tipo=arrepentimiento" className="text-bone-dim hover:text-ember">
              BOTÓN DE ARREPENTIMIENTO
            </Link>
            <Link href="/atencion?tipo=reclamo" className="text-bone-dim hover:text-ember">
              Reclamos y consultas
            </Link>
            <Link href="/privacidad" className="text-bone-dim hover:text-ember">
              Política de privacidad
            </Link>
          </div>
        </div>
      </div>

      <p className="border-t border-carbon-line px-5 py-6 text-center text-xs leading-6 text-bone-dim">
        &copy; 2026 Ragnar Suplementos.
        Página hecha por: nelsonsivisstum3@gmail.com
      </p>
    </footer>
  );
}
