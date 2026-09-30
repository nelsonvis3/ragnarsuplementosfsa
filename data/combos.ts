import { Combo } from "@/types/producto";
import { obtenerProductoPorId } from "@/data/productos";

// Los combos referencian productos por id, no los copian — así el precio
// y el stock de cada producto se leen siempre frescos desde data/productos.ts.
export const COMBOS: Combo[] = [
  {
    id: 1,
    slug: "combo-proteina-onefit-creatina-star",
    nombre: "Combo Proteína OneFit + Creatina Star",
    descripcion:
      "Proteína OneFit 907g junto a Creatina Star 300g, la combinación clásica para arrancar fuerte.",
    precio: 64000,
    imagen: "/productos-img/combos/proteina-onefit-creatina-star.jpg",
    productosIds: [1, 2],
  },
  {
    id: 2,
    slug: "combo-proteina-creatina-onefit-500g",
    nombre: "Combo Proteína OneFit + Creatina OneFit 500g",
    descripcion:
      "Proteína OneFit 907g junto a Creatina OneFit 500g, más cantidad de creatina para ciclos largos.",
    precio: 65000,
    imagen: "/productos-img/combos/proteina-onefit-creatina-500g.jpg",
    productosIds: [1, 13],
  },
  {
    id: 3,
    slug: "combo-proteina-creatina-onefit-200g",
    nombre: "Combo Proteína OneFit + Creatina OneFit 200g",
    descripcion:
      "Proteína OneFit 907g junto a Creatina OneFit Micronizada 200g, la opción más accesible para empezar.",
    precio: 50000,
    imagen: "/productos-img/combos/proteina-onefit-creatina-200g.jpg",
    productosIds: [1, 7],
  },
  {
    id: 4,
    slug: "combo-fuerza-total",
    nombre: "Combo Fuerza Total",
    descripcion:
      "Proteína OneFit 907g, Creatina OneFit Micronizada 200g y Colágeno OneFit 240g: el trío completo para rendimiento y recuperación.",
    precio: 66000,
    imagen: "/productos-img/combos/fuerza-total.jpg",
    productosIds: [1, 7, 10],
  },
  {
    id: 5,
    slug: "combo-proteina-star-creatina-star",
    nombre: "Combo Proteína Star + Creatina Star",
    descripcion:
      "Proteína Star junto a Creatina Star 300g, la línea Star completa en un solo combo.",
    precio: 99000,
    imagen: "/productos-img/combos/proteina-star-creatina-star.jpg",
    productosIds: [5, 2],
  },
];

export function obtenerComboPorSlug(slug: string): Combo | undefined {
  return COMBOS.find((c) => c.slug === slug);
}

export function obtenerComboPorId(id: number): Combo | undefined {
  return COMBOS.find((c) => c.id === id);
}

/**
 * El stock de un combo es el mínimo entre los productos que lo componen:
 * si falta una creatina, el combo no se puede vender aunque sobre proteína.
 */
export function calcularStockCombo(combo: Combo): number {
  const stocks = combo.productosIds.map((id) => {
    const producto = obtenerProductoPorId(id);
    return producto?.stock ?? 0;
  });

  if (stocks.length === 0) return 0;
  return Math.min(...stocks);
}

/**
 * Suma de los precios individuales de los productos del combo — sirve
 * para mostrar "antes $X" y calcular el ahorro real contra el precio
 * final del combo.
 */
export function calcularPrecioSumado(combo: Combo): number {
  return combo.productosIds.reduce((total, id) => {
    const producto = obtenerProductoPorId(id);
    return total + (producto?.precio ?? 0);
  }, 0);
}

export function calcularAhorro(combo: Combo): number {
  return calcularPrecioSumado(combo) - combo.precio;
}
