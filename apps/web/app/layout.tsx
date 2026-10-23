import type { Metadata } from "next";
import { Big_Shoulders_Display, DM_Mono, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const display = Big_Shoulders_Display({
  subsets: ["latin"],
  weight: ["700", "800", "900"],
  variable: "--f-display",
});
const body = Source_Serif_4({
  subsets: ["latin"],
  variable: "--f-body",
  style: ["normal", "italic"],
});
const mono = DM_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--f-mono" });

export const metadata: Metadata = {
  title: "Agent Aisle",
  description: "A store for Agent Skills.",
};

// Applies the saved theme before first paint. Absent or blocked storage means "follow the system".
const themeScript = `try{var t=localStorage.getItem("aisle-theme");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${display.variable} ${body.variable} ${mono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
