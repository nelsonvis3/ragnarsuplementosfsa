"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useSyncExternalStore } from "react";
import { ArrowUpRight, Boxes, Eye, EyeOff, LockKeyhole, Package, Pencil, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import {
  ApiError, eliminarArticuloAdministracion, guardarArticuloAdministracion, iniciarSesion,
  listarCatalogoAdministracion, obtenerPerfil,
  type ArticuloAdministracion, type ImagenSaborUpload, type RecursoAdministracion, type Usuario,
} from "@/lib/api";
import { useAuthStore } from "@/store/auth-store";
import ArticuloForm from "@/components/admin/ArticuloForm";

type Catalogo = Awaited<ReturnType<typeof listarCatalogoAdministracion>>;
type Editor = { articulo: ArticuloAdministracion | null; recurso: RecursoAdministracion };

const observarHidratacion = () => () => {};
const clienteListo = () => true;
const servidorListo = () => false;

function mensajeError(error: unknown) {
  return error instanceof Error ? error.message : "No pudimos completar la operación. Intentá nuevamente.";
}

function AccesoAdministracion() {
  const listo = useSyncExternalStore(observarHidratacion, clienteListo, servidorListo);
  const guardarSesion = useAuthStore((state) => state.iniciarSesion);
  const [error, setError] = useState<string | null>(null);
  const [cargando, setCargando] = useState(false);

  async function ingresar(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const datos = new FormData(event.currentTarget);
    setCargando(true);
    setError(null);
    try {
      const respuesta = await iniciarSesion(String(datos.get("usuario")), String(datos.get("password")));
      if (!respuesta.usuario.puede_administrar_catalogo) {
        setError("Esta cuenta no tiene acceso al catálogo. Ingresá con la cuenta administrativa de la tienda.");
        return;
      }
      guardarSesion(respuesta.token, respuesta.usuario);
    } catch (err) {
      setError(mensajeError(err));
    } finally {
      setCargando(false);
    }
  }

  return (
    <section className="mx-auto mt-10 max-w-md border border-carbon-line bg-carbon-raised p-6 sm:p-8">
      <LockKeyhole size={28} className="text-ember" />
      <h2 className="mt-5 font-display text-2xl font-semibold">Acceso administrativo</h2>
      <p className="mt-2 text-sm leading-6 text-bone-dim">Ingresá con la cuenta que administra Ragnar para gestionar el catálogo.</p>
      <form method="post" onSubmit={ingresar} className="mt-6 space-y-5">
        <label className="block text-sm font-medium" htmlFor="admin-usuario">Usuario o email
          <input id="admin-usuario" name="usuario" autoComplete="username" required className="mt-2 w-full border border-carbon-line bg-carbon px-3 py-3 outline-none focus:border-ember" />
        </label>
        <label className="block text-sm font-medium" htmlFor="admin-password">Contraseña
          <input id="admin-password" name="password" type="password" autoComplete="current-password" required className="mt-2 w-full border border-carbon-line bg-carbon px-3 py-3 outline-none focus:border-ember" />
        </label>
        {error && <p role="alert" className="border border-ember/40 bg-ember/10 p-3 text-sm text-ember">{error}</p>}
        <button disabled={!listo || cargando} type="submit" className="w-full bg-ember px-5 py-3 text-sm font-semibold text-carbon hover:bg-ember-bright disabled:opacity-60">{cargando ? "Ingresando…" : "Ingresar al panel"}</button>
      </form>
    </section>
  );
}

function CatalogoPanel({ token }: { token: string }) {
  const cerrarSesion = useAuthStore((state) => state.cerrarSesion);
  const [catalogo, setCatalogo] = useState<Catalogo | null>(null);
  const [recurso, setRecurso] = useState<RecursoAdministracion>("productos");
  const [busqueda, setBusqueda] = useState("");
  const [estado, setEstado] = useState("todos");
  const [editor, setEditor] = useState<Editor | null>(null);
  const [eliminando, setEliminando] = useState<ArticuloAdministracion | null>(null);
  const [ocupado, setOcupado] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    let vigente = true;
    listarCatalogoAdministracion(token).then((data) => {
      if (vigente) { setCatalogo(data); setError(null); }
    }).catch((err: unknown) => {
      if (!vigente) return;
      if (err instanceof ApiError && err.status === 401) cerrarSesion();
      else setError(mensajeError(err));
    });
    return () => { vigente = false; };
  }, [token, revision, cerrarSesion]);

  function reportarError(err: unknown) {
    if (err instanceof ApiError && err.status === 401) cerrarSesion();
    else setError(mensajeError(err));
  }

  async function refrescar() {
    try { setCatalogo(await listarCatalogoAdministracion(token)); }
    catch (err) { reportarError(err); }
  }

  async function actualizarListado() {
    setOcupado(true);
    setError(null);
    await refrescar();
    setOcupado(false);
  }

  function abrirEditor(articulo: ArticuloAdministracion | null) {
    setError(null);
    setMensaje(null);
    setEliminando(null);
    setEditor({ articulo, recurso });
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  async function guardar(datos: Record<string, unknown>, imagen: File | null, imagenesSabores: ImagenSaborUpload[]) {
    if (!editor) return;
    setOcupado(true);
    setError(null);
    setMensaje(null);
    try {
      await guardarArticuloAdministracion(token, editor.recurso, editor.articulo?.id ?? null, datos, imagen, imagenesSabores);
      setEditor(null);
      setMensaje("Cambios guardados. El catálogo de la tienda ya está actualizado.");
      await refrescar();
    } catch (err) { reportarError(err); }
    finally { setOcupado(false); }
  }

  async function cambiarPublicacion(articulo: ArticuloAdministracion) {
    setOcupado(true);
    setError(null);
    setMensaje(null);
    try {
      await guardarArticuloAdministracion(token, recurso, articulo.id, { activo: !articulo.activo });
      setMensaje(articulo.activo ? "Artículo despublicado. Se conserva en el panel." : "Artículo publicado.");
      await refrescar();
    } catch (err) { reportarError(err); }
    finally { setOcupado(false); }
  }

  async function confirmarEliminacion() {
    if (!eliminando) return;
    setOcupado(true);
    setError(null);
    setMensaje(null);
    try {
      await eliminarArticuloAdministracion(token, recurso, eliminando.id);
      setEliminando(null);
      setMensaje("Artículo eliminado del catálogo.");
      await refrescar();
    } catch (err) { reportarError(err); }
    finally { setOcupado(false); }
  }

  if (!catalogo) return <div className="mt-10" aria-live="polite">{error ? <><p role="alert" className="text-ember">{error}</p><button onClick={() => setRevision((r) => r + 1)} className="mt-4 border border-carbon-line px-4 py-2 text-sm hover:border-ember">Reintentar</button></> : <p className="text-bone-dim">Cargando catálogo…</p>}</div>;

  const articulos = catalogo[recurso];
  const termino = busqueda.trim().toLocaleLowerCase("es-AR");
  const filtrados = articulos.filter((a) => (
    `${a.nombre} ${a.slug} ${"categoria" in a ? a.categoria : "combo"}`.toLocaleLowerCase("es-AR").includes(termino)
    && (estado === "todos" || (estado === "publicados" ? a.activo : estado === "borradores" ? !a.activo : a.stock === 0))
  ));

  if (editor) return <ArticuloForm key={`${editor.recurso}-${editor.articulo?.id ?? "nuevo"}`} recurso={editor.recurso} articulo={editor.articulo} productos={catalogo.productos} guardando={ocupado} error={error} onCancelar={() => { setEditor(null); void actualizarListado(); }} onGuardar={guardar} />;

  return (
    <>
      <div className="mt-8 grid gap-3 sm:grid-cols-3">
        {[{ nombre: "Productos publicados", valor: catalogo.productos.filter((p) => p.activo).length, Icono: Package }, { nombre: "Productos sin stock", valor: catalogo.productos.filter((p) => p.activo && p.stock === 0).length, Icono: Boxes }, { nombre: "Combos publicados", valor: catalogo.combos.filter((c) => c.activo).length, Icono: Eye }].map(({ nombre, valor, Icono }) => <div key={nombre} className="flex items-center justify-between gap-4 border border-carbon-line bg-carbon-raised p-5"><div><p className="text-xs text-bone-dim">{nombre}</p><p className="mt-2 font-display text-3xl font-semibold">{valor}</p></div><Icono size={22} className="text-ember" /></div>)}
      </div>
      <section className="mt-8 border border-carbon-line bg-carbon-raised" aria-label="Gestión del catálogo" aria-busy={ocupado}>
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-carbon-line p-4 sm:p-5">
          <div className="flex gap-1" role="group" aria-label="Tipo de artículo">
            {(["productos", "combos"] as const).map((r) => <button key={r} disabled={ocupado} aria-pressed={recurso === r} onClick={() => { setRecurso(r); setEliminando(null); setEstado("todos"); setBusqueda(""); setError(null); }} className={`px-3 py-2 text-sm font-medium capitalize sm:px-4 ${recurso === r ? "bg-ember text-carbon" : "text-bone-dim hover:text-bone"}`}>{r} <span className="ml-1">{catalogo[r].length}</span></button>)}
          </div>
          <div className="flex flex-wrap gap-2"><button disabled={ocupado} onClick={() => void actualizarListado()} className="flex items-center gap-2 border border-carbon-line px-3 py-2 text-sm text-bone-dim hover:border-ember disabled:opacity-60"><RefreshCw size={15} /> Actualizar</button><button disabled={ocupado} onClick={() => abrirEditor(null)} className="flex items-center gap-2 border border-ember px-4 py-2 text-sm font-medium text-ember hover:bg-ember hover:text-carbon disabled:opacity-60"><Plus size={17} /> {recurso === "productos" ? "Nuevo producto" : "Nuevo combo"}</button></div>
        </div>
        <div className="grid gap-3 border-b border-carbon-line p-4 sm:grid-cols-[1fr_auto] sm:p-5">
          <label className="relative block"><span className="sr-only">Buscar en el catálogo</span><Search size={17} className="pointer-events-none absolute left-3 top-3 text-bone-dim" /><input type="search" value={busqueda} onChange={(e) => setBusqueda(e.target.value)} placeholder="Buscar por nombre o categoría…" className="w-full border border-carbon-line bg-carbon py-2.5 pl-10 pr-3 text-sm outline-none focus:border-ember" /></label>
          <label><span className="sr-only">Filtrar por estado</span><select value={estado} onChange={(e) => setEstado(e.target.value)} className="w-full border border-carbon-line bg-carbon px-3 py-2.5 text-sm outline-none focus:border-ember"><option value="todos">Todos los estados</option><option value="publicados">Publicados</option><option value="borradores">Despublicados</option><option value="sin-stock">Sin stock</option></select></label>
        </div>
        <div aria-live="polite">
          {mensaje && <p role="status" className="m-4 border border-signal/40 bg-signal/10 p-3 text-sm text-bone sm:m-5">{mensaje}</p>}
          {error && <div className="m-4 border border-ember/40 bg-ember/10 p-3 sm:m-5"><p role="alert" className="text-sm text-ember">{error}</p><button type="button" disabled={ocupado} onClick={() => { setError(null); setRevision((r) => r + 1); }} className="mt-2 text-sm underline">Actualizar listado</button></div>}
        </div>
        {eliminando && <section aria-label="Confirmar eliminación" className="m-4 border border-ember/40 bg-carbon p-4 sm:m-5"><h3 className="font-medium">Eliminar {eliminando.nombre}</h3><p className="mt-2 text-sm leading-6 text-bone-dim">Se eliminará de forma permanente. Si solo querés retirarlo de la tienda, podés despublicarlo.</p><div className="mt-4 flex flex-wrap gap-3"><button disabled={ocupado} onClick={confirmarEliminacion} className="bg-ember px-4 py-2 text-sm font-semibold text-carbon disabled:opacity-60">{ocupado ? "Eliminando…" : "Confirmar eliminación"}</button><button disabled={ocupado} onClick={() => { setEliminando(null); setError(null); }} className="border border-carbon-line px-4 py-2 text-sm">Cancelar eliminación</button><button disabled={ocupado} onClick={async () => { await cambiarPublicacion(eliminando); setEliminando(null); }} className="px-4 py-2 text-sm text-ember">{eliminando.activo ? "Despublicar" : "Publicar"}</button></div></section>}
        <div className="hidden grid-cols-[minmax(0,1fr)_110px_80px_100px_140px] gap-4 border-b border-carbon-line px-5 py-3 text-xs uppercase tracking-wide text-bone-dim lg:grid" aria-hidden="true"><span>Artículo</span><span>Precio</span><span>Stock</span><span>Estado</span><span className="text-right">Acciones</span></div>
        <ul>
          {filtrados.map((a) => {
            const comboIncompleto = "productos" in a && (a.productos.length === 0 || a.productos.some((id) => !catalogo.productos.find((p) => p.id === id)?.activo));
            return <li key={a.id} className="grid min-w-0 gap-4 border-b border-carbon-line p-4 last:border-b-0 sm:p-5 lg:grid-cols-[minmax(0,1fr)_110px_80px_100px_140px] lg:items-center">
              <div className="flex min-w-0 items-center gap-3"><div className="relative h-16 w-16 shrink-0 border border-carbon-line bg-carbon"><Image src={a.imagen} alt="" fill className="object-contain p-2" sizes="64px" /></div><div className="min-w-0"><h3 className="break-words text-sm font-medium">{a.nombre}</h3><p className="mt-1 text-xs capitalize text-bone-dim">{"categoria" in a ? a.categoria.replaceAll("-", " ") : `Combo · ${a.productos.length} productos`}</p>{comboIncompleto && <p className="mt-1 text-xs text-ember">Hay componentes despublicados. El combo no está disponible en la tienda.</p>}</div></div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm lg:contents"><span><span className="mr-1 text-xs text-bone-dim lg:hidden">Precio:</span>${a.precio.toLocaleString("es-AR")}</span><span className={a.stock === 0 ? "text-ember" : "text-bone-dim"}><span className="mr-1 text-xs lg:hidden">Stock:</span>{a.stock}</span><span className={`w-fit border px-2 py-1 text-xs ${a.activo ? "border-signal/40 text-bone" : "border-carbon-line text-bone-dim"}`}>{a.activo ? "Publicado" : "Despublicado"}</span></div>
              <div className="flex items-center gap-1 lg:justify-end"><button disabled={ocupado} onClick={() => abrirEditor(a)} aria-label={`Editar ${a.nombre}`} title="Editar" className="p-2.5 text-bone-dim hover:bg-carbon hover:text-ember disabled:opacity-40"><Pencil size={17} /></button><button disabled={ocupado} onClick={() => { setEliminando(null); void cambiarPublicacion(a); }} aria-label={`${a.activo ? "Despublicar" : "Publicar"} ${a.nombre}`} title={a.activo ? "Despublicar" : "Publicar"} className="p-2.5 text-bone-dim hover:bg-carbon hover:text-ember disabled:opacity-40">{a.activo ? <EyeOff size={17} /> : <Eye size={17} />}</button><button disabled={ocupado} onClick={() => { setEliminando(a); setError(null); setMensaje(null); }} aria-label={`Eliminar ${a.nombre}`} title="Eliminar" className="p-2.5 text-bone-dim hover:bg-carbon hover:text-ember disabled:opacity-40"><Trash2 size={17} /></button>{a.activo && !comboIncompleto && <Link href={`/${recurso}/${a.slug}`} target="_blank" rel="noopener noreferrer" aria-label={`Ver ${a.nombre} en la tienda`} title="Ver en la tienda" className="p-2.5 text-bone-dim hover:bg-carbon hover:text-ember"><ArrowUpRight size={17} /></Link>}</div>
            </li>;
          })}
        </ul>
        {filtrados.length === 0 && <div className="px-5 py-14 text-center"><Package size={30} className="mx-auto text-bone-dim" /><p className="mt-4 text-sm text-bone-dim">{articulos.length === 0 ? `Todavía no hay ${recurso}. Agregá el primero para empezar.` : "No hay artículos que coincidan con estos filtros."}</p></div>}
        <p className="border-t border-carbon-line px-5 py-3 text-xs text-bone-dim">{filtrados.length} de {articulos.length} {recurso}</p>
      </section>
    </>
  );
}

export default function AdministracionCatalogo() {
  const token = useAuthStore((state) => state.token);
  const usuario = useAuthStore((state) => state.usuario);
  const sesionVerificada = useAuthStore((state) => state.sesionVerificada);
  const guardarSesion = useAuthStore((state) => state.iniciarSesion);
  const cerrarSesion = useAuthStore((state) => state.cerrarSesion);
  const [perfil, setPerfil] = useState<{ token: string; usuario: Usuario } | null>(null);
  const [error, setError] = useState<{ token: string; mensaje: string } | null>(null);
  const [revision, setRevision] = useState(0);

  useEffect(() => {
    if (!token) return;
    let vigente = true;
    obtenerPerfil(token).then((usuario) => {
      if (!vigente) return;
      guardarSesion(token, usuario);
      setPerfil({ token, usuario });
      setError(null);
    }).catch((err: unknown) => {
      if (!vigente) return;
      if (err instanceof ApiError && err.status === 401) cerrarSesion();
      else setError({ token, mensaje: mensajeError(err) });
    });
    return () => { vigente = false; };
  }, [token, revision, guardarSesion, cerrarSesion]);

  return (
    <main className="flex-1">
      <div className="mx-auto max-w-6xl px-5 py-10 sm:py-14">
        <div className="flex flex-wrap items-end justify-between gap-4"><div><p className="text-xs font-medium uppercase tracking-widest text-ember">Ragnar / Administración</p><h1 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">Tu tienda, en orden.</h1><p className="mt-3 text-sm leading-6 text-bone-dim">Gestioná productos, imágenes, precios y stock desde un solo lugar.</p></div><Link href="/productos" className="flex items-center gap-2 text-sm text-bone-dim hover:text-ember">Ir a la tienda <ArrowUpRight size={17} /></Link></div>
        {!token ? <AccesoAdministracion /> : error?.token === token ? <div className="mt-10"><p role="alert" className="text-ember">{error.mensaje}</p><button onClick={() => setRevision((r) => r + 1)} className="mt-4 border border-carbon-line px-4 py-2 text-sm">Reintentar</button></div> : perfil?.token !== token || !sesionVerificada ? <p role="status" className="mt-10 text-bone-dim">Verificando acceso…</p> : !usuario?.puede_administrar_catalogo ? <div className="mt-10 border border-carbon-line bg-carbon-raised p-6"><h2 className="font-display text-xl">Tu cuenta no tiene acceso administrativo.</h2><p className="mt-2 text-sm text-bone-dim">Ingresá con la cuenta que gestiona el catálogo de Ragnar.</p><button onClick={cerrarSesion} className="mt-5 border border-ember px-4 py-2 text-sm text-ember">Ingresar con otra cuenta</button></div> : <CatalogoPanel key={token} token={token} />}
      </div>
    </main>
  );
}
