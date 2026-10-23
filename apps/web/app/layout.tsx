import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agent Aisle",
  description: "A store for Agent Skills.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
