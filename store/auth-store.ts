import { create } from "zustand";
import { persist } from "zustand/middleware";
import { Usuario } from "@/lib/api";

interface AuthState {
  token: string | null;
  usuario: Usuario | null;
  sesionVerificada: boolean;
  iniciarSesion: (token: string, usuario: Usuario) => void;
  cerrarSesion: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      usuario: null,
      sesionVerificada: false,

      iniciarSesion: (token, usuario) => set({ token, usuario, sesionVerificada: true }),

      cerrarSesion: () => set({ token: null, usuario: null, sesionVerificada: false }),
    }),
    {
      name: "ragnar_sesion",
      skipHydration: true,
      partialize: ({ token, usuario }) => ({ token, usuario }),
      merge: (persisted, current) => {
        const guardado = persisted as Partial<AuthState> | undefined;
        return { ...current, token: guardado?.token ?? null, usuario: guardado?.usuario ?? null, sesionVerificada: false };
      },
    }
  )
);
