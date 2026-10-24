// Arabic + Latin font pairing for next/font. Copy to src/app/fonts.ts (or src/lib/fonts.ts).
// Swap IBM_Plex_Sans_Arabic for the font in i18n.config.json (arabicFont); multi-word names use underscores,
// for example Noto_Sans_Arabic, Noto_Naskh_Arabic, Readex_Pro. Static (non-variable) fonts need `weight`.
import { IBM_Plex_Sans, IBM_Plex_Sans_Arabic } from "next/font/google";

export const arabicFont = IBM_Plex_Sans_Arabic({
  subsets: ["arabic", "latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-arabic",
});

export const latinFont = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "600"],
  display: "swap",
  variable: "--font-latin",
});

/** Put on <html>: `className={fontVariables}` exposes both CSS variables. */
export const fontVariables = `${arabicFont.variable} ${latinFont.variable}`;

/* Add to globals.css (Tailwind 4 shown; in v3 map the variables in tailwind.config):

   @theme inline { --font-sans: var(--font-latin), system-ui, sans-serif; }
   :lang(ar) { --font-sans: var(--font-arabic), var(--font-latin), system-ui, sans-serif; letter-spacing: normal; }
   :lang(ar) * { letter-spacing: normal; }
   body { font-family: var(--font-sans); line-height: 1.7; }
*/
