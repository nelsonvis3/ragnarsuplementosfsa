import { notFound } from "next/navigation";
import { obtenerComboPorSlug } from "@/lib/api";
import ComboPurchaseBox from "@/components/ComboPurchaseBox";
import AdvertenciaSuplemento from "@/components/AdvertenciaSuplemento";

export default async function DetalleComboPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const combo = await obtenerComboPorSlug(slug);

  if (!combo) {
    notFound();
  }

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <ComboPurchaseBox combo={combo} />
        <AdvertenciaSuplemento />
      </div>
    </main>
  );
}
