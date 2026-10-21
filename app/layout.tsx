import type { Metadata } from "next";
import { Archivo, IBM_Plex_Sans } from "next/font/google";
import StoreChrome from "@/components/StoreChrome";
import StoreHydration from "@/components/StoreHydration";
import "./globals.css";

const archivo = Archivo({
  variable: "--font-archivo",
  subsets: ["latin"],
  display: "swap",
});

const ibmPlexSans = IBM_Plex_Sans({
  variable: "--font-ibm-plex-sans",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Ragnar Suplementos",
  description:
    "Proteínas, creatinas, pre-entrenos y combos en Formosa. Ragnar Suplementos: la fuerza se construye.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="es"
      className={`${archivo.variable} ${ibmPlexSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var tema = localStorage.getItem('ragnar_tema');
                if (tema === 'light') {
                  document.documentElement.classList.add('light');
                }
              } catch (e) {}
            `,
          }}
        />
      </head>
      <body className="forge-app min-h-full flex flex-col bg-carbon text-bone">
        <StoreHydration />
        <StoreChrome>{children}</StoreChrome>
      </body>
    </html>
  );
}
