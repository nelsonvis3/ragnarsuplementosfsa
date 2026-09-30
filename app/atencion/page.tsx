import AtencionForm from "@/components/AtencionForm";

type TipoSolicitud = "arrepentimiento" | "reclamo" | "consulta";

export default async function AtencionPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  const { tipo: parametro } = await searchParams;
  const tipoInicial: TipoSolicitud = parametro === "reclamo" || parametro === "consulta" ? parametro : "arrepentimiento";

  return (
    <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-12 sm:py-16">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-ember">Atención al cliente</p>
      <h1 className="mt-3 font-display text-3xl font-bold sm:text-4xl">Arrepentimiento, reclamos y consultas</h1>
      <p className="mb-8 mt-3 text-sm leading-6 text-bone-dim">Completá el formulario. Tu solicitud quedará registrada para que podamos darle seguimiento.</p>
      <AtencionForm tipoInicial={tipoInicial} />
      <p className="mt-5 text-sm text-bone-dim">También podés escribir a <a className="text-ember underline" href="mailto:adansiv16@gmail.com">adansiv16@gmail.com</a> o al <a className="text-ember underline" href="https://wa.me/5493704696533">WhatsApp de Ragnar</a>.</p>
    </main>
  );
}
