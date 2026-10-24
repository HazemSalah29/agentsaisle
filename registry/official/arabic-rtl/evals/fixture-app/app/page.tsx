import { ArrowRight } from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import { Carousel } from "../components/Carousel";
import { ProductCard } from "../components/ProductCard";
import { ContactForm } from "../components/ContactForm";
import { CartSummary } from "../components/CartSummary";

export default function Home() {
  return (
    <>
      <Sidebar />
      <main className="flex-1 md:ml-64 pl-6 pr-4 text-left">
        <h1 className="text-3xl font-bold tracking-wide uppercase">Welcome to the shop</h1>
        <p className="mt-2 text-gray-600">Free delivery on orders over $50.</p>
        <a href="/products" className="mt-4 inline-flex items-center rounded-l-lg bg-black px-4 py-2 text-white">
          Shop now
          <ArrowRight className="ml-2 h-4 w-4" />
        </a>
        <Carousel />
        <ProductCard name="Canvas backpack" price={49.5} added={new Date("2026-03-14")} />
        <CartSummary count={3} total={148.5} />
        <ContactForm />
      </main>
    </>
  );
}
