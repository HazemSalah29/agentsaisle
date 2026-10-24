import clsx from "clsx";

export function Sidebar({ open = true }: { open?: boolean }) {
  return (
    <aside className={clsx("sidebar-divider fixed left-0 hidden md:block top-0 h-full w-64 border-r bg-gray-50", open && "shadow-lg")}>
      <nav className="space-x-4 p-4">
        <a href="/">Home</a>
        <a href="/orders">Orders</a>
      </nav>
      <div className={`absolute right-2 top-2 !mr-1 ${open ? "pl-2" : "pr-2"}`}>Menu</div>
    </aside>
  );
}
