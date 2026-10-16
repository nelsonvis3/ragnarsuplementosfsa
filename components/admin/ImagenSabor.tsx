"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";

interface Props {
  numero: number;
  imagen: string;
  principal: string;
  archivo: File | null;
  onArchivo: (archivo: File | null) => void;
  onImagen: (url: string) => void;
  onError: (mensaje: string | null) => void;
}

export default function ImagenSabor({ numero, imagen, principal, archivo, onArchivo, onImagen, onError }: Props) {
  const [preview, setPreview] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  const urlValida = (imagen.startsWith("/") && !imagen.startsWith("//")) || imagen.startsWith("https://res.cloudinary.com/");

  function seleccionar(event: React.ChangeEvent<HTMLInputElement>) {
    const nueva = event.target.files?.[0];
    if (!nueva) return;
    if (nueva.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(nueva.type)) {
      onError("Elegí una imagen JPG, PNG o WebP de hasta 5 MB para el sabor.");
      event.target.value = "";
      return;
    }
    onArchivo(nueva);
    setPreview(URL.createObjectURL(nueva));
    onError(null);
  }

  function quitar() {
    onArchivo(null);
    onImagen("");
    setPreview(null);
    if (input.current) input.current.value = "";
  }

  return (
    <div className="grid min-w-0 gap-3 sm:grid-cols-[80px_minmax(0,1fr)]">
      <div className="relative h-20 w-20 border border-carbon-line bg-carbon">
        <Image src={preview || (urlValida && imagen) || principal} alt={`Vista previa del sabor ${numero}`} fill unoptimized sizes="80px" className="object-contain p-2" />
      </div>
      <div className="min-w-0">
        <label htmlFor={`sabor-archivo-${numero}`} className="flex items-center gap-2 text-xs font-medium"><Upload size={14} /> Imagen del sabor {numero}</label>
        <input ref={input} id={`sabor-archivo-${numero}`} type="file" accept="image/jpeg,image/png,image/webp" onChange={seleccionar} className="mt-2 w-full min-w-0 text-xs text-bone-dim file:mr-2 file:border-0 file:bg-ember file:px-2 file:py-2 file:text-carbon" />
        <p className="mt-2 text-xs leading-5 text-bone-dim">JPG, PNG o WebP. Hasta 5 MB. {archivo ? "Se subirá al guardar el producto." : !imagen ? "Usa la imagen principal." : "Tiene una imagen propia."}</p>
        {(archivo || imagen) && <button type="button" onClick={quitar} className="mt-1 text-xs text-ember hover:underline">Usar imagen principal para sabor {numero}</button>}
        <details className="mt-3 text-xs text-bone-dim">
          <summary className="cursor-pointer hover:text-ember">Usar una imagen existente</summary>
          <label htmlFor={`sabor-imagen-${numero}`} className="mt-2 block">URL de la imagen del sabor {numero}</label>
          <input id={`sabor-imagen-${numero}`} maxLength={500} value={imagen} onChange={(event) => onImagen(event.target.value)} className="mt-2 w-full min-w-0 border border-carbon-line bg-carbon px-3 py-2.5 text-xs outline-none focus:border-ember" />
        </details>
      </div>
    </div>
  );
}
