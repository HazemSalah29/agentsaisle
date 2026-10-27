const columns: Array<{ title: string; links: Array<{ href: string; label: string }> }> = [
  {
    title: "Product",
    links: [
      { href: "/skills", label: "Skills" },
      { href: "/aisles", label: "Aisles" },
      { href: "/profiles", label: "Profiles" },
      { href: "/submit", label: "Submit a skill" },
    ],
  },
  {
    title: "Resources",
    links: [
      { href: "/docs", label: "Docs" },
      { href: "/registry.json", label: "registry.json" },
      { href: "https://github.com/HazemSalah29/agentsaisle/issues", label: "Report a skill" },
    ],
  },
  {
    title: "Community",
    links: [
      { href: "https://github.com/HazemSalah29/agentsaisle", label: "GitHub" },
      { href: "https://www.npmjs.com/org/agentsaisle", label: "npm" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="border-t border-line bg-bg-raised">
      <div className="mx-auto grid max-w-[1200px] border-x border-line md:grid-cols-[1.4fr_repeat(3,1fr)]">
        <div className="p-6">
          <p className="font-display text-md font-semibold text-ink-strong">Agent Aisle</p>
          <p className="mt-2 text-sm text-muted">
            Audit Agent Skills before you trust them. Plus a store of audited skills.
          </p>
        </div>
        {columns.map((c) => (
          <nav
            key={c.title}
            aria-label={c.title}
            className="border-t border-line p-6 md:border-l md:border-t-0"
          >
            <p className="hud-label text-muted">{c.title}</p>
            <ul className="mt-4 space-y-2 text-sm">
              {c.links.map((l) => (
                <li key={l.href}>
                  <a href={l.href} className="hover:text-accent-ink hover:underline">
                    {l.label}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
      <div className="border-t border-line">
        <p className="hud-label mx-auto max-w-[1200px] border-x border-line px-6 py-4 text-muted">
          © 2026 Agent Aisle
        </p>
      </div>
    </footer>
  );
}
