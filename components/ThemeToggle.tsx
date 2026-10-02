"use client";

import { useSyncExternalStore } from "react";
import { Sun, Moon } from "lucide-react";

function subscribe(callback: () => void) {
  const observer = new MutationObserver(callback);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
  return () => observer.disconnect();
}

function getSnapshot() {
  return document.documentElement.classList.contains("light");
}

function getServerSnapshot() {
  return false;
}

export default function ThemeToggle() {
  const esClaro = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  function alternarTema() {
    const nuevoEsClaro = !document.documentElement.classList.contains("light");
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
