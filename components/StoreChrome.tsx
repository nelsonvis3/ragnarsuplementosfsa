"use client";

import { usePathname } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

// La autenticación tiene navegación propia, sin navbar ni footer de la tienda.
const rutasDeCuenta = new Set([
  "/login",
  "/confirmar-email",
  "/recuperar-contrasena",
  "/restablecer-contrasena",
]);

export default function StoreChrome({ children }: { children: React.ReactNode }) {
  const esCuenta = rutasDeCuenta.has(usePathname());
  return (
    <>
      {!esCuenta && <Navbar />}
      {children}
      {!esCuenta && <Footer />}
    </>
  );
}
