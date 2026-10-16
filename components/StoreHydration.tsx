"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/auth-store";
import { useCartStore } from "@/store/cart-store";
import { ApiError, obtenerPerfil } from "@/lib/api";

export default function StoreHydration() {
  const token = useAuthStore((state) => state.token);
  useEffect(() => {
    void useCartStore.persist.rehydrate();
    void useAuthStore.persist.rehydrate();
  }, []);

  useEffect(() => {
    if (!token) return;
    const tokenActual = token;
    let activo = true;
    let pendiente = false;
    async function verificar() {
      if (pendiente || document.visibilityState === "hidden") return;
      pendiente = true;
      try {
        const usuario = await obtenerPerfil(tokenActual);
        if (activo && useAuthStore.getState().token === token) {
          useAuthStore.getState().iniciarSesion(tokenActual, usuario);
        }
      } catch (error) {
        if (activo && useAuthStore.getState().token === token) {
          if (error instanceof ApiError && error.status === 401) useAuthStore.getState().cerrarSesion();
          else useAuthStore.setState({ sesionVerificada: false });
        }
      } finally {
        pendiente = false;
      }
    }
    void verificar();
    window.addEventListener("focus", verificar);
    document.addEventListener("visibilitychange", verificar);
    return () => {
      activo = false;
      window.removeEventListener("focus", verificar);
      document.removeEventListener("visibilitychange", verificar);
    };
  }, [token]);

  return null;
}
