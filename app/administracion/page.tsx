import type { Metadata } from "next";
import AdministracionCatalogo from "@/components/admin/AdministracionCatalogo";

export const metadata: Metadata = {
  title: "Administración | Ragnar Suplementos",
  robots: { index: false, follow: false },
};

export default function AdministracionPage() {
  return <AdministracionCatalogo />;
}
