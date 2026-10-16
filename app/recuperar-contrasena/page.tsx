import type { Metadata } from "next";
import RecuperacionContrasena from "@/components/RecuperacionContrasena";

export const metadata: Metadata = {
  title: "Recuperar contraseña | Ragnar Suplementos",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function RecuperarContrasenaPage() {
  return <RecuperacionContrasena />;
}
