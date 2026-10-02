import { create } from "zustand";
import { persist } from "zustand/middleware";

export interface CartItem {
  productoId: number;
  sabor: string | null;
  cantidad: number;
}

export interface CartCombo {
  comboId: number;
  precioUnitario: number;
  cantidad: number;
  productosIds?: number[];
}

interface CartState {
  items: CartItem[];
  combos: CartCombo[];
  agregarItem: (productoId: number, sabor: string | null, cantidad?: number, stockDisponible?: number) => boolean;
  actualizarCantidad: (productoId: number, sabor: string | null, delta: number, stockDisponible?: number) => void;
  eliminarItem: (productoId: number, sabor: string | null) => void;
  agregarCombo: (comboId: number, precioUnitario: number, cantidad?: number, stockDisponible?: number, productosIds?: number[]) => boolean;
  actualizarCantidadCombo: (comboId: number, delta: number, stockDisponible?: number) => void;
  eliminarCombo: (comboId: number) => void;
  vaciarCarrito: () => void;
}

const CANTIDAD_MAXIMA_POR_LINEA = 20;

function mismoItem(item: CartItem, productoId: number, sabor: string | null) {
  return item.productoId === productoId && item.sabor === sabor;
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      combos: [],

      agregarItem: (productoId, sabor, cantidad = 1, stockDisponible = CANTIDAD_MAXIMA_POR_LINEA) => {
        const cantidadAgregar = Math.max(1, Math.min(CANTIDAD_MAXIMA_POR_LINEA, Math.floor(cantidad)));
        let agregado = false;
        set((state) => {
          const existente = state.items.find((item) => mismoItem(item, productoId, sabor));
          const cantidadActual = existente?.cantidad ?? 0;
          if (cantidadActual + cantidadAgregar > Math.min(CANTIDAD_MAXIMA_POR_LINEA, stockDisponible)) return state;
          agregado = true;
          if (existente) {
            return {
              items: state.items.map((item) =>
                mismoItem(item, productoId, sabor)
                  ? { ...item, cantidad: item.cantidad + cantidadAgregar }
                  : item
              ),
            };
          }
          return { items: [...state.items, { productoId, sabor, cantidad: cantidadAgregar }] };
        });
        return agregado;
      },

      actualizarCantidad: (productoId, sabor, delta, stockDisponible = CANTIDAD_MAXIMA_POR_LINEA) =>
        set((state) => {
          const itemActual = state.items.find((item) => mismoItem(item, productoId, sabor));
          if (!itemActual) return state;
          const cantidad = Math.max(0, Math.min(CANTIDAD_MAXIMA_POR_LINEA, stockDisponible, itemActual.cantidad + Math.trunc(delta)));
          return {
            items: state.items
              .map((item) => (mismoItem(item, productoId, sabor) ? { ...item, cantidad } : item))
              .filter((item) => item.cantidad > 0),
          };
        }),

      eliminarItem: (productoId, sabor) =>
        set((state) => ({ items: state.items.filter((item) => !mismoItem(item, productoId, sabor)) })),

      agregarCombo: (comboId, precioUnitario, cantidad = 1, stockDisponible = CANTIDAD_MAXIMA_POR_LINEA, productosIds = []) => {
        const cantidadAgregar = Math.max(1, Math.min(CANTIDAD_MAXIMA_POR_LINEA, Math.floor(cantidad)));
        let agregado = false;
        set((state) => {
          const existente = state.combos.find((item) => item.comboId === comboId);
          const cantidadActual = existente?.cantidad ?? 0;
          if (cantidadActual + cantidadAgregar > Math.min(CANTIDAD_MAXIMA_POR_LINEA, stockDisponible)) return state;
          agregado = true;
          if (existente) {
            return {
              combos: state.combos.map((item) =>
                item.comboId === comboId
                  ? {
                      ...item,
                      precioUnitario,
                      productosIds,
                      cantidad: item.cantidad + cantidadAgregar,
                    }
                  : item
              ),
            };
          }
          return {
            combos: [...state.combos, { comboId, precioUnitario, cantidad: cantidadAgregar, productosIds }],
          };
        });
        return agregado;
      },

      actualizarCantidadCombo: (comboId, delta, stockDisponible = CANTIDAD_MAXIMA_POR_LINEA) =>
        set((state) => {
          const comboActual = state.combos.find((item) => item.comboId === comboId);
          if (!comboActual) return state;
          const cantidad = Math.max(0, Math.min(CANTIDAD_MAXIMA_POR_LINEA, stockDisponible, comboActual.cantidad + Math.trunc(delta)));
          return {
            combos: state.combos
              .map((item) => (item.comboId === comboId ? { ...item, cantidad } : item))
              .filter((item) => item.cantidad > 0),
          };
        }),

      eliminarCombo: (comboId) =>
        set((state) => ({ combos: state.combos.filter((combo) => combo.comboId !== comboId) })),

      vaciarCarrito: () => set({ items: [], combos: [] }),
    }),
    { name: "ragnar_carrito", skipHydration: true }
  )
);
