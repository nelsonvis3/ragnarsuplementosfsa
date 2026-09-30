"use client";

import { useEffect, useState } from "react";
import { Sun, Moon } from "lucide-react";

export default function ThemeToggle() {
  const [esClaro, setEsClaro] = useState(false);

  // Sincroniza el estado del botón con la clase que ya haya en <html>
  // (aplicada por el script inline en layout.tsx antes de la hidratación).
  useEffect(() => {
    setEsClaro(document.documentElement.classList.contains("light"));
  }, []);

  function alternarTema() {
    const nuevoEsClaro = !esClaro;
    setEsClaro(nuevoEsClaro);
    document.documentElement.classList.toggle("light", nuevoEsClaro);
    localStorage.setItem("ragnar_tema", nuevoEsClaro ? "light" : "dark");
  }

  return (
    <button
      aria-label={esClaro ? "Cambiar a modo oscuro" : "Cambiar a modo claro"}
      onClick={alternarTema}
      className="border border-carbon-line p-2 transition-colors hover:border-ember"
    >
      {esClaro ? <Moon size={18} /> : <Sun size={18} />}
    </button>
  );
}
