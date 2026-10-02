import Link from "next/link";
import { Phone, Mail, MapPin } from "lucide-react";
import Logo from "@/components/Logo";

const INSTAGRAM_PATH =
  "M12 2c2.7 0 3.05.01 4.12.06 1.07.05 1.79.22 2.43.46.66.26 1.22.6 1.77 1.15.55.55.9 1.11 1.15 1.77.24.64.41 1.36.46 2.43.05 1.07.06 1.42.06 4.12s-.01 3.05-.06 4.12c-.05 1.07-.22 1.79-.46 2.43-.26.66-.6 1.22-1.15 1.77-.55.55-1.11.9-1.77 1.15-.64.24-1.36.41-2.43.46-1.07.05-1.42.06-4.12.06s-3.05-.01-4.12-.06c-1.07-.05-1.79-.22-2.43-.46-.66-.26-1.22-.6-1.77-1.15-.55-.55-.9-1.11-1.15-1.77-.24-.64-.41-1.36-.46-2.43C2.01 15.05 2 14.7 2 12s.01-3.05.06-4.12c.05-1.07.22-1.79.46-2.43.26-.66.6-1.22 1.15-1.77.55-.55 1.11-.9 1.77-1.15.64-.24 1.36-.41 2.43-.46C8.95 2.01 9.3 2 12 2zm0 1.8c-2.65 0-2.97.01-4.02.06-.87.04-1.34.18-1.65.3-.42.16-.71.35-1.02.66-.31.31-.5.6-.66 1.02-.12.31-.26.78-.3 1.65C4.31 9.03 4.3 9.35 4.3 12s.01 2.97.06 4.02c.04.87.18 1.34.3 1.65.16.42.35.71.66 1.02.31.31.6.5 1.02.66.31.12.78.26 1.65.3 1.05.05 1.37.06 4.02.06s2.97-.01 4.02-.06c.87-.04 1.34-.18 1.65-.3.42-.16.71-.35 1.02-.66.31-.31.5-.6.66-1.02.12-.31.26-.78.3-1.65.05-1.05.06-1.37.06-4.02s-.01-2.97-.06-4.02c-.04-.87-.18-1.34-.3-1.65-.16-.42-.35-.71-.66-1.02-.31-.31-.6-.5-1.02-.66-.31-.12-.78-.26-1.65-.3C14.97 3.81 14.65 3.8 12 3.8zm0 3.05a5.15 5.15 0 1 1 0 10.3 5.15 5.15 0 0 1 0-10.3zm0 1.8a3.35 3.35 0 1 0 0 6.7 3.35 3.35 0 0 0 0-6.7zm5.35-1.99a1.2 1.2 0 1 1-2.4 0 1.2 1.2 0 0 1 2.4 0z";

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-carbon-line">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-3">
            <Logo width={32} height={52} className="h-8 w-auto" />
            <span className="font-display text-lg font-semibold tracking-wide">
              RAGNAR
            </span>
          </div>
          <p className="mt-3 text-sm text-bone-dim">Fuerza que se nota.</p>
        </div>

        <div id="contacto" className="scroll-mt-24">
          <h4 className="font-display text-sm font-semibold uppercase tracking-wide text-bone-dim">
            Contacto
          </h4>
          <div className="mt-3 flex flex-col gap-2">
            <Link
              href="tel:+5493704696533"
              className="flex items-center gap-2 text-sm text-bone-dim transition-colors hover:text-ember"
            >
              <Phone size={16} />
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
              <svg viewBox="0 0 24 24" width={16} height={16}>
                <path fill="currentColor" d={INSTAGRAM_PATH} />
              </svg>
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

      <p className="border-t border-carbon-line py-5 text-center text-xs text-bone-dim">
        &copy; 2026 Ragnar Suplementos.
        Pagina hecha por: nelsonsivisstum3@gmail.com
      </p>
    </footer>
  );
}
