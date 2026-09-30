export interface Sabor {
  nombre: string;
  imagen: string;
}

export interface Producto {
  id: number;
  slug: string;
  nombre: string;
  categoria: string;
  precio: number;
  precioAnterior?: number;
  imagen: string;
  descripcion: string;
  sabores: Sabor[];
  stock: number;
  rating?: number;
  esNuevo?: boolean;
}

export interface Combo {
  id: number;
  slug: string;
  nombre: string;
  descripcion: string;
  precio: number;
  imagen: string;
  productosIds: number[];
  productos?: Producto[];
  stock?: number;
}
