import { notFound } from "next/navigation";
import { obtenerProductoPorSlug } from "@/lib/api";
import ProductPurchaseBox from "@/components/ProductPurchaseBox";
import AdvertenciaSuplemento from "@/components/AdvertenciaSuplemento";

export default async function DetalleProductoPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const producto = await obtenerProductoPorSlug(slug);

  if (!producto) {
    notFound();
  }

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-6xl px-5 py-14">
        <ProductPurchaseBox producto={producto} />
        {producto.categoria !== "alimentos" && <AdvertenciaSuplemento />}
      </div>
    </main>
  );
}
