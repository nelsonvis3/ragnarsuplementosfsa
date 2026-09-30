import { Producto } from "@/types/producto";

// Catálogo completo. Las imágenes se sirven desde /public/productos-img/,
// así que las rutas acá llevan "/" inicial (a diferencia de la v1 en HTML
// puro, donde una barra inicial rompía las rutas relativas).
export const PRODUCTOS: Producto[] = [
  {
    id: 1,
    slug: "proteina-onefit",
    nombre: "Proteina OneFit",
    categoria: "proteinas",
    precio: 42000,
    imagen: "/productos-img/proteinas/proteina-onefit/proteina-onefit-907gr.png",
    descripcion:
      "Proteína de suero de alta pureza, 24g de proteína por porción. Ideal para recuperación muscular post-entreno.",
    sabores: [
      { nombre: "Dulce de Leche", imagen: "/productos-img/proteinas/proteina-onefit/proteina-onefit-907gr.png" },
      { nombre: "Vainilla", imagen: "/productos-img/proteinas/proteina-onefit/proteina-onefit-907gr.png" },
      { nombre: "Frutilla", imagen: "/productos-img/proteinas/proteina-onefit/proteina-onefit-907gr.png" },
      { nombre: "Lemon pie", imagen: "/productos-img/proteinas/proteina-onefit/proteina-onefit-907gr.png" },
      { nombre: "Chocolate", imagen: "/productos-img/proteinas/proteina-onefit/proteina-onefit-907gr.png" },
      { nombre: "Banana Cream", imagen: "/productos-img/proteinas/proteina-onefit/proteina-onefit-907gr.png" },
    ],
    stock: 10,
  },
  {
    id: 2,
    slug: "creatina-star-300-gramos",
    nombre: "Creatina Star 300 gramos",
    categoria: "creatina",
    precio: 27000,
    imagen: "/productos-img/creatinas/creatina-star/creatinastar.png",
    descripcion:
      "Creatina monohidratada micronizada, 100% pura. Aumenta fuerza y potencia en el entrenamiento.",
    sabores: [
      { nombre: "Sin sabor", imagen: "/productos-img/creatinas/creatina-star/creatinastar.png" },
      { nombre: "Frutos Rojos", imagen: "/productos-img/creatinas/creatina-star/frutosrojos.png" },
    ],
    stock: 10,
  },
  {
    id: 3,
    slug: "pre-entreno-onefit-300-gramos",
    nombre: "Pre Entreno OneFit 300 gramos",
    categoria: "pre-entreno",
    precio: 20000,
    imagen: "/productos-img/pre-entrenos/pre-onefit300g-uva.png",
    descripcion:
      "Fórmula explosiva con cafeína, beta-alanina y citrulina para máxima energía y foco.",
    sabores: [
      { nombre: "Uva", imagen: "/productos-img/pre-entrenos/pre-onefit300g-uva.png" },
    ],
    stock: 10,
  },
  {
    id: 4,
    slug: "citrato-de-magnesio-star-60-capsulas",
    nombre: "Citrato de Magnesio Star 60 capsulas",
    categoria: "vitaminas",
    precio: 18000,
    imagen: "/productos-img/citrato-magnesio/mag-star-60caps.png",
    descripcion:
      "Citrato de magnesio Star en presentación de 60 cápsulas. Consultá el envase para conocer su composición e indicaciones de uso.",
    sabores: [
      { nombre: "Sin sabor", imagen: "/productos-img/citrato-magnesio/mag-star-60caps.png" },
    ],
    stock: 10,
  },
  {
    id: 5,
    slug: "proteina-star",
    nombre: "Proteina Star",
    categoria: "proteinas",
    precio: 68000,
    imagen: "/productos-img/proteinas/proteina-star/cookieandcream.png",
    descripcion:
      "Aislado de proteína de rápida absorción, bajo en grasas y carbohidratos.",
    sabores: [
      { nombre: "Cookie and Cream", imagen: "/productos-img/proteinas/proteina-star/cookieandcream.png" },
      { nombre: "Frutilla", imagen: "/productos-img/proteinas/proteina-star/protestarfrutilla.png" },
    ],
    stock: 10,
  },
  {
    id: 6,
    slug: "omega-3-onefit-30-capsulas",
    nombre: "Omega 3 OneFit 30 capsulas",
    categoria: "vitaminas",
    precio: 24000,
    imagen: "/productos-img/vitaminas/omega3-one.png",
    descripcion:
      "Ácidos grasos esenciales EPA/DHA para salud cardiovascular y articular.",
    sabores: [
      { nombre: "Sin sabor", imagen: "/productos-img/vitaminas/omega3-one.png" },
    ],
    stock: 10,
  },
  {
    id: 7,
    slug: "creatina-onefit-micronizada-200g",
    nombre: "Creatina OneFit Micronizada 200g",
    categoria: "creatina",
    precio: 27000,
    imagen: "/productos-img/creatinas/creatina-onefit/creatinaonefit2gr.png",
    descripcion:
      "Creatina monohidratada micronizada OneFit en presentación de 200 g. Consultá el envase para conocer su composición e indicaciones de uso.",
    sabores: [
      { nombre: "Sin sabor", imagen: "/productos-img/creatinas/creatina-onefit/creatinaonefit2gr.png" },
    ],
    stock: 10,
  },
  {
    id: 8,
    slug: "caffeine-200-star-30-capsulas",
    nombre: "Caffeine 200 Star 30 Capsulas",
    categoria: "pre-entreno",
    precio: 12000,
    imagen: "/productos-img/pre-entrenos/prework.png",
    descripcion:
      "Caffeine 200 Star en presentación de 30 cápsulas. Consultá el envase para conocer su composición e indicaciones de uso.",
    sabores: [
      { nombre: "Sin sabor", imagen: "/productos-img/pre-entrenos/prework.png" },
    ],
    stock: 10,
  },
  {
    id: 9,
    slug: "pancakes-400g",
    nombre: "Pancakes 400g",
    categoria: "alimentos",
    precio: 16000,
    imagen: "/productos-img/alimentos/keto-pancakes-waffles.png",
    descripcion:
      "Pancakes en presentación de 400 g, disponibles en las opciones indicadas. Consultá el envase para conocer su composición e indicaciones de uso.",
    sabores: [
      { nombre: "Keto y Waffles", imagen: "/productos-img/alimentos/keto-pancakes-waffles.png" },
      { nombre: "Chocolate", imagen: "/productos-img/alimentos/pancakes-chocolate.png" },
    ],
    stock: 10,
  },
  {
    id: 10,
    slug: "colageno-onefit-240g",
    nombre: "Colageno OneFit 240g",
    categoria: "colageno",
    precio: 18000,
    imagen: "/productos-img/colagenos/colageno-onefit/colagenofrutilla.png",
    descripcion:
      "Colágeno OneFit en presentación de 240 g y sabor frutilla. Consultá el envase para conocer su composición e indicaciones de uso.",
    sabores: [
      { nombre: "Frutilla", imagen: "/productos-img/colagenos/colageno-onefit/colagenofrutilla.png" },
    ],
    stock: 10,
  },
  {
    id: 11,
    slug: "colageno-hydroflex-xbody-330-gramos",
    nombre: "Colageno hydroflex Xbody 330 gramos",
    categoria: "colageno",
    precio: 18000,
    imagen: "/productos-img/colagenos/colageno-xbody/colagenoxbody.png",
    descripcion:
      "Colágeno Hydroflex Xbody en presentación de 330 g. Consultá el envase para conocer su composición e indicaciones de uso.",
    sabores: [
      { nombre: "Frutilla", imagen: "/productos-img/colagenos/colageno-onefit/colagenofrutilla.png" },
    ],
    stock: 10,
  },
  {
    id: 12,
    slug: "mutantmass-star-1-5kg",
    nombre: "MutantMass Star 1,5kg",
    categoria: "mass",
    precio: 50000,
    imagen: "/productos-img/ganador-de-masa/mutantmass.png",
    descripcion:
      "MutantMass Star en presentación de 1,5 kg, disponible en los sabores indicados. Consultá el envase para conocer su composición e indicaciones de uso.",
    sabores: [
      { nombre: "Cookies and Cream", imagen: "/productos-img/ganador-de-masa/mutantmass.png" },
      { nombre: "Vainilla", imagen: "/productos-img/ganador-de-masa/mutantmass.png" },
      { nombre: "Frutilla", imagen: "/productos-img/ganador-de-masa/mutantmass.png" },
      { nombre: "Chocolate", imagen: "/productos-img/ganador-de-masa/mutantmass.png" },
      { nombre: "Banana Cream", imagen: "/productos-img/ganador-de-masa/mutantmass.png" },
    ],
    stock: 10,
  },
  {
    id: 13,
    slug: "creatina-onefit-500g",
    nombre: "Creatina OneFit 500g",
    categoria: "creatina",
    precio: 30000,
    imagen: "/productos-img/creatinas/creatina-onefit/onefit-500gr.png",
    descripcion:
      "Creatina OneFit en presentación de 500 g. Consultá el envase para conocer su composición e indicaciones de uso.",
    sabores: [
      { nombre: "Sin sabor", imagen: "/productos-img/creatinas/creatina-onefit/onefit-500gr.png" },
    ],
    stock: 10,
  },
  {
    id: 14,
    slug: "pasta-de-mani-entrenuts-370g",
    nombre: "Pasta de Mani Entrenuts 370g",
    categoria: "alimentos",
    precio: 5500,
    imagen: "/productos-img/alimentos/mantequillas.png",
    descripcion:
      "Pasta de maní Entrenuts en presentación de 370 g, disponible en los sabores indicados. Consultá el envase para conocer sus ingredientes e indicaciones de uso.",
    sabores: [
      { nombre: "Caramelo Salado", imagen: "/productos-img/alimentos/mantequilla.png" },
      { nombre: "Cookies & Cream", imagen: "/productos-img/alimentos/mantequilla.png" },
    ],
    stock: 10,
  },
];

export function obtenerProductoPorSlug(slug: string): Producto | undefined {
  return PRODUCTOS.find((p) => p.slug === slug);
}

export function obtenerProductoPorId(id: number): Producto | undefined {
  return PRODUCTOS.find((p) => p.id === id);
}

export function obtenerProductosPorCategoria(categoria: string): Producto[] {
  if (categoria === "todos") return PRODUCTOS;
  return PRODUCTOS.filter((p) => p.categoria === categoria);
}

export function obtenerCategorias(): string[] {
  return Array.from(new Set(PRODUCTOS.map((p) => p.categoria)));
}