import { ThemeToggle } from "./ThemeToggle";

export const NAV = [
  { href: "/skills", label: "Skills" },
  { href: "/aisles", label: "Aisles" },
  { href: "/profiles", label: "Profiles" },
  { href: "/audit", label: "Audit" },
  { href: "/submit", label: "Submit" },
  { href: "/docs", label: "Docs" },
  { href: "https://github.com/HazemSalah29/agentsaisle", label: "GitHub" },
];

function Mark() {
  // Four shelf slots in a square: our own mark, not borrowed from anywhere.
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="1.5" y="1.5" width="21" height="21" stroke="currentColor" strokeWidth="2" />
      <path d="M1.5 12h21M12 12v10.5" stroke="currentColor" strokeWidth="2" />
      <rect x="15" y="4.5" width="4.5" height="4.5" fill="var(--accent)" />
    </svg>
  );
}

const cell =
  "hud-label flex h-full items-center whitespace-nowrap px-4 text-muted hover:bg-invert-bg hover:text-invert-fg";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-line bg-bg/95 backdrop-blur-sm">
      <div className="mx-auto flex h-12 max-w-[1200px] items-stretch justify-between border-x border-line">
        <div className="flex min-w-0 items-stretch">
          <a
            href="/"
            className="flex items-center gap-2.5 border-r border-line px-4 text-ink-strong hover:opacity-70"
          >
            <Mark />
            <span className="font-display text-base font-semibold tracking-tight">Agent Aisle</span>
          </a>
          <nav aria-label="Main" className="hidden items-stretch md:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className={cell}>
                {n.label}
              </a>
            ))}
          </nav>
        </div>
        <div className="flex items-stretch">
          <details className="group relative md:hidden">
            <summary
              className={`${cell} cursor-pointer list-none border-l border-line [&::-webkit-details-marker]:hidden`}
            >
              Menu
            </summary>
            <nav
              aria-label="Main"
              className="absolute right-0 top-12 w-56 border border-line bg-bg-raised"
            >
              {NAV.map((n) => (
                <a
                  key={n.href}
                  href={n.href}
                  className="hud-label block border-b border-line px-4 py-3 text-ink hover:bg-invert-bg hover:text-invert-fg"
                >
                  {n.label}
                </a>
              ))}
            </nav>
          </details>
          <ThemeToggle />
          <a
            href="/docs#install"
            className="hud-label hidden items-center border-l border-line bg-invert-bg px-5 font-bold text-invert-fg hover:opacity-80 sm:flex"
          >
            Install CLI
          </a>
        </div>
      </div>
    </header>
  );
}
