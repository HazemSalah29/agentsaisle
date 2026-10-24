export function CartSummary({ count, total }: { count: number; total: number }) {
  const label = new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(total);
  return (
    <section className="mt-6">
      <p>{count} items</p>
      <p>Total: {label}</p>
      <p>Hello, {`${count} items in your cart`}</p>
    </section>
  );
}
