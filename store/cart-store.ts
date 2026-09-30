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
}

interface CartState {
  items: CartItem[];
  combos: CartCombo[];
  agregarItem: (productoId: number, sabor: string | null, cantidad?: number) => boolean;
  actualizarCantidad: (productoId: number, sabor: string | null, delta: number) => void;
  eliminarItem: (productoId: number, sabor: string | null) => void;
  agregarCombo: (comboId: number, precioUnitario: number, cantidad?: number) => boolean;
  actualizarCantidadCombo: (comboId: number, delta: number) => void;
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

      agregarItem: (productoId, sabor, cantidad = 1) => {
        const cantidadAgregar = Math.max(1, Math.min(CANTIDAD_MAXIMA_POR_LINEA, Math.floor(cantidad)));
        set((state) => {
          const existente = state.items.find((item) => mismoItem(item, productoId, sabor));
          if (existente) {
            return {
              items: state.items.map((item) =>
                mismoItem(item, productoId, sabor)
                  ? { ...item, cantidad: Math.min(CANTIDAD_MAXIMA_POR_LINEA, item.cantidad + cantidadAgregar) }
                  : item
              ),
            };
          }
          return { items: [...state.items, { productoId, sabor, cantidad: cantidadAgregar }] };
        });
        return true;
      },

      actualizarCantidad: (productoId, sabor, delta) =>
        set((state) => {
          const itemActual = state.items.find((item) => mismoItem(item, productoId, sabor));
          if (!itemActual) return state;
          const cantidad = Math.max(0, Math.min(CANTIDAD_MAXIMA_POR_LINEA, itemActual.cantidad + Math.trunc(delta)));
          return {
            items: state.items
              .map((item) => (mismoItem(item, productoId, sabor) ? { ...item, cantidad } : item))
              .filter((item) => item.cantidad > 0),
          };
        }),

      eliminarItem: (productoId, sabor) =>
        set((state) => ({ items: state.items.filter((item) => !mismoItem(item, productoId, sabor)) })),

      agregarCombo: (comboId, precioUnitario, cantidad = 1) => {
        const cantidadAgregar = Math.max(1, Math.min(CANTIDAD_MAXIMA_POR_LINEA, Math.floor(cantidad)));
        set((state) => {
          const existente = state.combos.find((item) => item.comboId === comboId);
          if (existente) {
            return {
              combos: state.combos.map((item) =>
                item.comboId === comboId
                  ? {
                      ...item,
                      precioUnitario,
                      cantidad: Math.min(CANTIDAD_MAXIMA_POR_LINEA, item.cantidad + cantidadAgregar),
                    }
                  : item
              ),
            };
          }
          return {
            combos: [...state.combos, { comboId, precioUnitario, cantidad: cantidadAgregar }],
          };
        });
        return true;
      },

      actualizarCantidadCombo: (comboId, delta) =>
        set((state) => {
          const comboActual = state.combos.find((item) => item.comboId === comboId);
          if (!comboActual) return state;
          const cantidad = Math.max(0, Math.min(CANTIDAD_MAXIMA_POR_LINEA, comboActual.cantidad + Math.trunc(delta)));
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
