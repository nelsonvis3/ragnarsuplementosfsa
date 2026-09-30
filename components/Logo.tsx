"use client";

import { useEffect, useState } from "react";
import Image from "next/image";

interface LogoProps {
  width: number;
  height: number;
  className?: string;
  priority?: boolean;
}

export default function Logo({ width, height, className, priority }: LogoProps) {
  const [esClaro, setEsClaro] = useState(false);

  useEffect(() => {
    const actualizar = () =>
      setEsClaro(document.documentElement.classList.contains("light"));

    actualizar();

    // El tema puede cambiar sin recargar la página (ThemeToggle), así que
    // observamos la clase del <html> para reaccionar en el momento.
    const observer = new MutationObserver(actualizar);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    return () => observer.disconnect();
  }, []);

  return (
    <Image
      src={esClaro ? "/logo-dark.png" : "/logo.png"}
      alt="Ragnar"
      width={width}
      height={height}
      className={className}
      priority={priority}
    />
  );
}
