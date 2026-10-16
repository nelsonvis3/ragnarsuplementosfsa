import type { Metadata } from "next";
import ConfirmacionEmail from "@/components/ConfirmacionEmail";

export const metadata: Metadata = {
  title: "Confirmar e-mail | Ragnar Suplementos",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function ConfirmarEmailPage() {
  return <ConfirmacionEmail />;
}
