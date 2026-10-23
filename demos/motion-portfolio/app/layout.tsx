import type { Metadata } from "next";
import { Anybody, Hanken_Grotesk } from "next/font/google";
import { SiteShell } from "../src/components/kit";
import "./globals.css";

// Anybody has a width axis: headlines can mix condensed and expanded lines.
const display = Anybody({ subsets: ["latin"], axes: ["wdth"], variable: "--f-display" });
const body = Hanken_Grotesk({ subsets: ["latin"], variable: "--f-body" });

export const metadata: Metadata = {
  title: "Lowtide Studio",
  description:
    "Demo site for the design-motion-portfolio skill from Agent Aisle. Not a real studio.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <SiteShell>{children}</SiteShell>
      </body>
    </html>
  );
}
