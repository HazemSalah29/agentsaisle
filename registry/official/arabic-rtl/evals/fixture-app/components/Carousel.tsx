import { ChevronLeft, ChevronRight } from "lucide-react";

export function Carousel() {
  return (
    <section className="relative mt-8 overflow-hidden">
      <div className="flex translate-x-0 gap-4 transition-transform md:-ml-2 hover:pr-2">
        <div className="bg-gradient-to-r from-orange-200 to-white p-8">Summer sale</div>
        <div className="p-8">New arrivals</div>
      </div>
      <button aria-label="Previous slide" className="absolute left-2 top-1/2 -translate-x-1/2">
        <ChevronLeft />
      </button>
      <button aria-label="Next slide" className="absolute right-2 top-1/2">
        <ChevronRight />
      </button>
    </section>
  );
}
