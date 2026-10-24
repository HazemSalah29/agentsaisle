export function ProductCard({ name, price, added }: { name: string; price: number; added: Date }) {
  return (
    <article className="mt-6 border-l-4 border-orange-500 pl-4">
      <h2 className="text-xl">{name}</h2>
      <p>{"Price: " + price.toFixed(2)}</p>
      <p>Added on {added.toLocaleDateString()}</p>
      <p>{price.toLocaleString()}</p>
      <p className="text-sm text-gray-500 tracking-tight">Fast and free returns</p>
    </article>
  );
}
