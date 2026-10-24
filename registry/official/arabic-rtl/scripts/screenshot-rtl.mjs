#!/usr/bin/env node
// Takes en and ar screenshots of each route at 1440 px and 390 px and flags horizontal overflow in ar.
// Needs Playwright in the project (it is imported from there; this skill adds no dependency) and a
// running app. Writes only into .agent-aisle/rtl-screens/. It never starts or builds the app.
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";

export const WIDTHS = [1440, 390];

export const slug = (route) => route.replace(/^\/+|\/+$/g, "").replace(/[^\w-]+/g, "-") || "home";

/** URL for a locale and route; `{base}`, `{locale}` and `{route}` are filled into the pattern. */
export function buildUrl(pattern, base, locale, route) {
  return pattern
    .replace("{base}", base.replace(/\/+$/, ""))
    .replace("{locale}", locale)
    .replace("{route}", route === "/" ? "" : route.startsWith("/") ? route : `/${route}`);
}

/** Every screenshot to take: { url, locale, width, route, file }. */
export function planShots({ routes, locales, base, pattern, outDir }) {
  const shots = [];
  for (const route of routes)
    for (const locale of locales)
      for (const width of WIDTHS)
        shots.push({
          route,
          locale,
          width,
          url: buildUrl(pattern, base, locale, route),
          file: path.join(outDir, `${slug(route)}.${locale}.${width}.png`),
        });
  return shots;
}

async function loadPlaywright(cwd) {
  try {
    const req = createRequire(path.join(cwd, "package.json"));
    return await import(pathToFileURL(req.resolve("playwright")).href);
  } catch {
    return null;
  }
}

async function main(argv) {
  const { flags } = parseArgs(argv, {
    booleans: ["json"],
    strings: ["base-url", "routes", "locales", "out", "url-pattern"],
  });
  const cwd = process.cwd();
  const shots = planShots({
    routes: (flags.routes ?? "/")
      .split(",")
      .map((r) => r.trim())
      .filter(Boolean),
    locales: (flags.locales ?? "en,ar").split(",").map((l) => l.trim()),
    base: flags["base-url"] ?? "http://localhost:3000",
    pattern: flags["url-pattern"] ?? "{base}/{locale}{route}",
    outDir: path.resolve(cwd, flags.out ?? ".agent-aisle/rtl-screens"),
  });
  const pw = await loadPlaywright(cwd);
  if (!pw) {
    console.error(
      "Playwright is not installed in this project. Run: npm install -D playwright && npx playwright install chromium",
    );
    process.exit(2);
  }
  const chromium = pw.chromium ?? pw.default?.chromium;
  mkdirSync(path.resolve(cwd, flags.out ?? ".agent-aisle/rtl-screens"), { recursive: true });
  const browser = await chromium.launch();
  const lines = [];
  let overflow = 0;
  try {
    for (const s of shots) {
      const page = await browser.newPage({ viewport: { width: s.width, height: 900 } });
      try {
        const res = await page.goto(s.url, { waitUntil: "networkidle", timeout: 30000 });
        if (!res || res.status() >= 400) {
          lines.push(`FAIL ${s.url}: HTTP ${res?.status() ?? "no response"}`);
          continue;
        }
        await page.screenshot({ path: s.file, fullPage: true });
        const wide = await page.evaluate(
          () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
        );
        if (wide && s.locale === "ar") {
          overflow++;
          lines.push(`OVERFLOW ${s.route} ar @${s.width}px: horizontal scroll`);
        }
      } catch (e) {
        lines.push(`FAIL ${s.url}: ${String(e.message).split("\n")[0]}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
  }
  const failed = lines.filter((l) => l.startsWith("FAIL")).length;
  console.log(
    capLines(
      lines,
      `${shots.length - failed} screenshot(s) in ${flags.out ?? ".agent-aisle/rtl-screens"}; ${overflow} overflow(s) in ar`,
    ),
  );
  process.exit(overflow || failed ? 1 : 0);
}

if (isEntry(import.meta.url)) await main(process.argv.slice(2));
