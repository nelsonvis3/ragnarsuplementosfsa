"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, Plus, Upload, X } from "lucide-react";
import type { ArticuloAdministracion, ImagenSaborUpload, ProductoAdministracion, RecursoAdministracion } from "@/lib/api";
import type { Sabor } from "@/types/producto";
import ImagenSabor from "@/components/admin/ImagenSabor";

type SaborEditable = Sabor & { clave: number; archivo: File | null };

const inputClass = "mt-2 w-full border border-carbon-line bg-carbon px-3 py-2.5 text-sm outline-none focus:border-ember disabled:opacity-60";

function crearSlug(nombre: string) {
  return nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 50);
}

interface Props {
  recurso: RecursoAdministracion;
  articulo: ArticuloAdministracion | null;
  productos: ProductoAdministracion[];
  guardando: boolean;
  error: string | null;
  onCancelar: () => void;
  onGuardar: (datos: Record<string, unknown>, imagen: File | null, imagenesSabores: ImagenSaborUpload[]) => Promise<void>;
}

export default function ArticuloForm({ recurso, articulo, productos, guardando, error, onCancelar, onGuardar }: Props) {
  const esProducto = recurso === "productos";
  const producto = articulo && "categoria" in articulo ? articulo : null;
  const [nombre, setNombre] = useState(articulo?.nombre ?? "");
  const [slug, setSlug] = useState(articulo?.slug ?? "");
  const [slugManual, setSlugManual] = useState(Boolean(articulo));
  const [categoria, setCategoria] = useState(producto?.categoria ?? "");
  const [descripcion, setDescripcion] = useState(articulo?.descripcion ?? "");
  const [precio, setPrecio] = useState(String(articulo?.precio ?? ""));
  const [stock, setStock] = useState(String(articulo?.stock ?? 0));
  const [activo, setActivo] = useState(articulo?.activo ?? true);
  const [sabores, setSabores] = useState<SaborEditable[]>(() => (producto?.sabores ?? []).map((s, clave) => ({ ...s, clave, archivo: null })));
  const siguienteSabor = useRef(sabores.length);
  const [componentes, setComponentes] = useState<number[]>(articulo && "productos" in articulo ? articulo.productos : []);
  const [imagenUrl, setImagenUrl] = useState(articulo?.imagen_url ?? "");
  const [archivo, setArchivo] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  function seleccionarImagen(event: React.ChangeEvent<HTMLInputElement>) {
    const imagen = event.target.files?.[0];
    if (!imagen) return;
    if (imagen.size > 5 * 1024 * 1024 || !["image/jpeg", "image/png", "image/webp"].includes(imagen.type)) {
      setErrorLocal("Elegí una imagen JPG, PNG o WebP de hasta 5 MB.");
      event.target.value = "";
      return;
    }
    setArchivo(imagen);
    setPreview(URL.createObjectURL(imagen));
    setErrorLocal(null);
  }

  async function enviar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorLocal(null);
    if (!esProducto && componentes.length === 0) {
      setErrorLocal("Elegí al menos un producto para el combo.");
      return;
    }
    if (activo && !archivo && !imagenUrl && !articulo?.imagen_url && (!articulo || articulo.imagen === "/logo-ember.png")) {
      setErrorLocal("Agregá una imagen antes de publicar el artículo.");
      return;
    }
    const datos: Record<string, unknown> = {
      nombre: nombre.trim(), slug, descripcion: descripcion.trim(), precio: Number(precio), activo,
      imagen_url: imagenUrl.trim(),
      ...(esProducto ? { categoria: categoria.trim().toLowerCase(), stock: Number(stock), sabores: sabores.map(({ nombre, imagen }) => ({ nombre, imagen })) } : { productos: componentes }),
    };
    const imagenesSabores = sabores.flatMap((sabor, indice) => sabor.archivo ? [{ indice, archivo: sabor.archivo }] : []);
    if (articulo) {
      const anterior = articulo as unknown as Record<string, unknown>;
      for (const campo of Object.keys(datos)) {
        if (campo === "sabores" && imagenesSabores.length) continue;
        if (JSON.stringify(datos[campo]) === JSON.stringify(anterior[campo])) delete datos[campo];
      }
      if (producto && "stock" in datos) datos.stock_anterior = producto.stock;
    }
    await onGuardar(datos, archivo, imagenesSabores);
  }

  return (
    <section aria-labelledby="editor-titulo" className="mt-8 border border-carbon-line bg-carbon-raised">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-carbon-line p-5 sm:p-6">
        <h2 id="editor-titulo" className="font-display text-xl font-semibold">{articulo ? "Editar" : "Nuevo"} {esProducto ? "producto" : "combo"}</h2>
        <button type="button" disabled={guardando} onClick={onCancelar} className="flex items-center gap-2 text-sm text-bone-dim hover:text-ember disabled:opacity-60"><ArrowLeft size={16} /> Volver al listado</button>
      </div>
      <form onSubmit={enviar} className="p-5 sm:p-6" aria-busy={guardando}>
        <fieldset disabled={guardando} className="grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <div className="min-w-0">
            <div className="relative aspect-square border border-carbon-line bg-carbon">
              <Image src={preview || articulo?.imagen || "/logo-ember.png"} alt={nombre || "Vista previa del artículo"} fill unoptimized className="object-contain p-6" sizes="(min-width: 1024px) 30vw, 90vw" />
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm font-medium" htmlFor="imagen-archivo"><Upload size={16} /> {articulo ? "Cambiar imagen" : "Subir imagen"}</label>
            <input id="imagen-archivo" type="file" accept="image/jpeg,image/png,image/webp" onChange={seleccionarImagen} className="mt-2 w-full min-w-0 text-xs text-bone-dim file:mr-3 file:border-0 file:bg-ember file:px-3 file:py-2 file:font-medium file:text-carbon" />
            <p className="mt-2 text-xs leading-5 text-bone-dim">JPG, PNG o WebP. Hasta 5 MB.</p>
            <details className="mt-5 text-sm text-bone-dim">
              <summary className="cursor-pointer hover:text-ember">Usar una imagen existente</summary>
              <label className="mt-3 block" htmlFor="imagen-url">URL de Cloudinary o ruta local</label>
              <input id="imagen-url" maxLength={500} value={imagenUrl} onChange={(e) => setImagenUrl(e.target.value)} className={inputClass} placeholder="/productos-img/imagen.png" />
              <p className="mt-2 text-xs leading-5">Si el artículo ya tiene una imagen subida, se conserva hasta que subas otra.</p>
            </details>
            <label className="mt-6 flex items-start gap-3 border border-carbon-line p-4">
              <input type="checkbox" checked={activo} onChange={(e) => setActivo(e.target.checked)} className="mt-1 accent-ember" />
              <span className="text-sm"><span className="block font-medium">Publicado en la tienda</span><span className="mt-1 block text-xs leading-5 text-bone-dim">Desmarcá para retirar el artículo del catálogo.</span></span>
            </label>
          </div>
          <div className="min-w-0 space-y-5">
            <label className="block text-sm font-medium" htmlFor="articulo-nombre">Nombre
              <input id="articulo-nombre" required maxLength={180} value={nombre} onChange={(e) => { setNombre(e.target.value); if (!slugManual) setSlug(crearSlug(e.target.value)); }} className={inputClass} placeholder={esProducto ? "Ej. Creatina 300 g" : "Ej. Combo fuerza"} />
            </label>
            <div className="grid gap-5 sm:grid-cols-2">
              <label className="block text-sm font-medium" htmlFor="articulo-precio">Precio (ARS)
                <input id="articulo-precio" required type="number" inputMode="decimal" min="0.01" max="9999999999.99" step="0.01" value={precio} onChange={(e) => setPrecio(e.target.value)} className={inputClass} />
              </label>
              {esProducto && <label className="block text-sm font-medium" htmlFor="articulo-stock">Stock disponible
                <input id="articulo-stock" required type="number" inputMode="numeric" min="0" max="2147483647" step="1" value={stock} onChange={(e) => setStock(e.target.value)} className={inputClass} />
                <span className="mt-1 block text-xs font-normal text-bone-dim">Unidades disponibles para nuevas compras.</span>
              </label>}
            </div>
            {esProducto && <label className="block text-sm font-medium" htmlFor="articulo-categoria">Categoría
              <input id="articulo-categoria" required maxLength={80} list="categorias-catalogo" value={categoria} onChange={(e) => setCategoria(e.target.value)} className={inputClass} placeholder="Ej. creatinas" />
              <datalist id="categorias-catalogo">{Array.from(new Set([...productos.map((p) => p.categoria), "proteinas", "creatinas", "pre-entreno", "vitaminas", "alimentos"])).sort().map((c) => <option key={c} value={c} />)}</datalist>
            </label>}
            <label className="block text-sm font-medium" htmlFor="articulo-descripcion">Descripción
              <textarea id="articulo-descripcion" rows={4} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} className={inputClass} />
            </label>
            {esProducto ? <div>
              <div className="flex items-center justify-between gap-3"><h3 className="text-sm font-medium">Sabores</h3><button type="button" disabled={sabores.length >= 30} onClick={() => setSabores([...sabores, { nombre: "", imagen: "", archivo: null, clave: siguienteSabor.current++ }])} className="flex items-center gap-1 text-sm text-ember disabled:opacity-60"><Plus size={15} /> Agregar sabor</button></div>
              <p className="mt-1 text-xs text-bone-dim">La imagen del sabor es opcional; se usa la imagen principal si la dejás vacía.</p>
              {sabores.map((sabor, i) => <div key={sabor.clave} className="mt-3 flex items-start gap-2 border border-carbon-line p-3">
                <div className="grid min-w-0 flex-1 gap-3">
                  <label className="text-xs" htmlFor={`sabor-${i}`}>Sabor {i + 1}<input id={`sabor-${i}`} required maxLength={100} value={sabor.nombre} onChange={(e) => setSabores(sabores.map((s, n) => n === i ? { ...s, nombre: e.target.value } : s))} className={inputClass} /></label>
                  <ImagenSabor numero={i + 1} imagen={sabor.imagen} archivo={sabor.archivo} principal={preview || articulo?.imagen || "/logo-ember.png"} onArchivo={(archivo) => setSabores((actuales) => actuales.map((s) => s.clave === sabor.clave ? { ...s, archivo } : s))} onImagen={(imagen) => setSabores((actuales) => actuales.map((s) => s.clave === sabor.clave ? { ...s, imagen } : s))} onError={setErrorLocal} />
                </div>
                <button type="button" onClick={() => setSabores(sabores.filter((_, n) => n !== i))} aria-label={`Eliminar sabor ${i + 1}`} className="mt-6 p-2 text-bone-dim hover:text-ember"><X size={17} /></button>
              </div>)}
            </div> : <div>
              <h3 className="text-sm font-medium">Productos incluidos</h3><p className="mt-1 text-xs leading-5 text-bone-dim">Una unidad de cada producto. El stock del combo depende de sus componentes; todos deben estar publicados para venderlo.</p>
              <div className="mt-3 max-h-64 overflow-y-auto border border-carbon-line p-3">
                {productos.length === 0 && <p className="text-sm text-bone-dim">Primero creá los productos que va a incluir este combo.</p>}
                {productos.map((p) => <label key={p.id} className="flex cursor-pointer items-center gap-3 border-b border-carbon-line py-3 last:border-b-0"><input type="checkbox" checked={componentes.includes(p.id)} onChange={(e) => setComponentes(e.target.checked ? [...componentes, p.id] : componentes.filter((id) => id !== p.id))} className="accent-ember" /><span className="text-sm">{p.nombre}<span className="ml-2 text-xs text-bone-dim">{p.activo ? `Stock: ${p.stock}` : "Despublicado"}</span></span></label>)}
              </div>
            </div>}
            <label className="block text-sm font-medium" htmlFor="articulo-slug">Dirección en la tienda
              <input id="articulo-slug" required maxLength={50} pattern="[a-zA-Z0-9_-]+" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugManual(true); }} className={inputClass} aria-describedby="slug-ayuda" />
              <span id="slug-ayuda" className="mt-1 block break-all text-xs font-normal text-bone-dim">/{recurso}/{slug || "nombre-del-articulo"}{articulo ? ". Cambiarla modifica el enlace público." : ""}</span>
            </label>
          </div>
        </fieldset>
        {(errorLocal || error) && <p role="alert" className="mt-6 border border-ember/40 bg-ember/10 p-4 text-sm text-ember">{errorLocal || error}</p>}
        <div className="mt-8 flex flex-wrap justify-end gap-3 border-t border-carbon-line pt-5">
          <button type="button" disabled={guardando} onClick={onCancelar} className="border border-carbon-line px-5 py-3 text-sm hover:border-ember disabled:opacity-60">Cancelar</button>
          <button type="submit" disabled={guardando} className="bg-ember px-6 py-3 text-sm font-semibold text-carbon hover:bg-ember-bright disabled:cursor-wait disabled:opacity-60">{guardando ? "Guardando…" : "Guardar cambios"}</button>
        </div>
      </form>
    </section>
  );
}
