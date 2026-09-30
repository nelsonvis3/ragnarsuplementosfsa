import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Destacados from "@/components/Destacados";
import Nosotros from "@/components/Nosotros";
import CheckoutNotice from "@/components/CheckoutNotice";

export default function Home() {
  return (
    <main className="flex-1">
      <CheckoutNotice />
      <Hero />
      <Features />
      <Destacados />
      <Nosotros />
    </main>
  );
}
