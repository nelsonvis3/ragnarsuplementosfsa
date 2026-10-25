"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import JuegoCartas from "@/components/JuegoCartas";
import { IconoMarca } from "@/components/IconosMarca";
import { useEffect } from "react";
import { registrarVisita } from "@/lib/api";

// Las rutas de acceso tienen navegación mínima; no muestran el menú ni el footer.
const rutasDeCuenta = new Set([
  "/login",
  "/confirmar-email",
  "/recuperar-contrasena",
  "/restablecer-contrasena",
]);

export default function StoreChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const esCuenta = rutasDeCuenta.has(pathname);
  const esPanel = pathname.startsWith("/administracion");
  useEffect(() => { if (!esPanel) void registrarVisita(pathname); }, [pathname, esPanel]);
  return (
    <>
      {!esCuenta && <Navbar />}
      {esCuenta && pathname !== "/login" && (
        <nav className="mx-auto w-full max-w-6xl px-5 pt-6 sm:px-8" aria-label="Volver a la tienda">
          <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-bone-dim hover:text-bone">
            <ArrowLeft size={17} aria-hidden="true" /> Volver a la tienda
          </Link>
        </nav>
      )}
      {children}
      {!esCuenta && <Footer />}
      {!esCuenta && !esPanel && <>
        <JuegoCartas />
        <a href="https://wa.me/5493704696533?text=Hola%20Ragnar%2C%20quiero%20hacer%20una%20consulta." target="_blank" rel="noopener noreferrer" aria-label="Escribinos por WhatsApp"
          className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-[#1fa855] text-white shadow-[0_10px_30px_rgba(0,0,0,.35)] hover:bg-[#178a45]">
          <IconoMarca marca="whatsapp" size={28} />
        </a>
      </>}
    </>
  );
}
