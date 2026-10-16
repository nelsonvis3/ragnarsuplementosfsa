import type { Metadata } from "next";
import RecuperacionContrasena from "@/components/RecuperacionContrasena";

export const metadata: Metadata = {
  title: "Nueva contraseña | Ragnar Suplementos",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function RestablecerContrasenaPage() {
  return <RecuperacionContrasena restablecer />;
}
