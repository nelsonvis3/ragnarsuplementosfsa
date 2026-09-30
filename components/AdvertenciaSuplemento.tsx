export default function AdvertenciaSuplemento({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`border border-carbon-line bg-carbon text-bone-dim ${compact ? "px-2 py-2 text-xs leading-5" : "mt-5 p-4 text-sm leading-6"}`}>
      SUPLEMENTA DIETAS INSUFICIENTES. CONSULTE A SU MÉDICO Y/O FARMACÉUTICO.
    </p>
  );
}
