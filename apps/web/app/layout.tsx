import type { Metadata } from "next";
import { Analytics } from "@vercel/analytics/next";
import { Archivo, Geist_Mono, IBM_Plex_Sans, Instrument_Serif } from "next/font/google";
import { SiteFooter } from "../components/SiteFooter";
import { SITE_URL } from "../lib/site";
import { SiteHeader } from "../components/SiteHeader";
import "./globals.css";

const display = Archivo({ subsets: ["latin"], variable: "--f-display" });
const serif = Instrument_Serif({
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
  variable: "--f-serif",
});
const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--f-body",
});
const mono = Geist_Mono({ subsets: ["latin"], variable: "--f-mono" });

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: "Agent Aisle",
  description: "A store for Agent Skills.",
};

// Applies the saved theme before first paint. Absent or blocked storage means "follow the system".
const themeScript = `try{var t=localStorage.getItem("aisle-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${serif.variable} ${body.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>
        <a
          href="#main"
          className="hud-label sr-only focus:not-sr-only focus:fixed focus:left-2 focus:top-2 focus:z-[60] focus:bg-invert-bg focus:px-4 focus:py-3 focus:text-invert-fg"
        >
          Skip to content
        </a>
        <SiteHeader />
        <main id="main" className="mx-auto max-w-[1200px] border-x border-line">
          {children}
        </main>
        <SiteFooter />
        <Analytics />
      </body>
    </html>
  );
}
