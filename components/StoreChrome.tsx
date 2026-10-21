"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

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
    </>
  );
}
