#!/usr/bin/env node
// Takes full-page screenshots of every route at 1440 px and 390 px so you can look at your own work.
// It needs the site running (npm run dev, or build + start) and Playwright with a browser installed.
import { existsSync, mkdirSync, readdirSync, realpathSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const VIEWPORTS = [
  { name: "1440", width: 1440, height: 900 },
  { name: "390", width: 390, height: 844 },
];

/** Static routes from the page files of an App Router project. Dynamic routes are skipped. */
export function routesFromPages(files) {
  const routes = new Set();
  for (const f of files) {
    const m = /(?:^|\/)app\/(.*?)\/?page\.(?:tsx|jsx|ts|js|mdx)$/.exec(f.split(path.sep).join("/"));
    if (!m) continue;
    const segments = m[1].split("/").filter(Boolean);
    if (segments.some((s) => s.startsWith("[") || s.startsWith("@"))) continue;
    routes.add("/" + segments.filter((s) => !/^\(.*\)$/.test(s)).join("/"));
  }
  return [...routes].sort();
}

/** File name for a route and viewport: "/" at 1440 becomes "home-1440.png". */
export function shotName(route, viewport) {
  const slug = route.replace(/^\/|\/$/g, "").replace(/[^a-z0-9]+/gi, "-") || "home";
  return `${slug}-${viewport}.png`;
}

export function parseArgs(argv) {
  const get = (flag, fallback) => (argv.includes(flag) ? argv[argv.indexOf(flag) + 1] : fallback);
  return {
    url: get("--url", "http://localhost:3000").replace(/\/$/, ""),
    out: get("--out", ".agent-aisle/screens"),
    routes: get("--routes", "") ? get("--routes", "").split(",") : null,
    reduced: argv.includes("--reduced-motion"),
    cwd: path.resolve(get("--cwd", process.cwd())),
  };
}

function pageFiles(dir, out = []) {
  if (!existsSync(dir)) return out;
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name === ".next") continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) pageFiles(full, out);
    else if (/^page\./.test(e.name)) out.push(full);
  }
  return out;
}

async function loadPlaywright(cwd) {
  for (const name of ["playwright", "@playwright/test"]) {
    try {
      const resolved = (await import("node:module"))
        .createRequire(path.join(cwd, "noop.js"))
        .resolve(name);
      const mod = await import(pathToFileURL(resolved).href);
      const chromium = mod.chromium ?? mod.default?.chromium;
      if (chromium) return { chromium };
    } catch {
      /* try the next name */
    }
  }
  return null;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const pw = await loadPlaywright(args.cwd);
  if (!pw) {
    console.log(
      "screenshot: Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium",
    );
    process.exit(1);
  }
  const routes =
    args.routes ??
    routesFromPages(
      ["src/app", "app"]
        .flatMap((d) => pageFiles(path.join(args.cwd, d)))
        .map((f) => path.relative(args.cwd, f)),
    );
  if (routes.length === 0) routes.push("/");
  const outDir = path.resolve(args.cwd, args.out);
  mkdirSync(outDir, { recursive: true });

  let browser;
  try {
    browser = await pw.chromium.launch();
  } catch (e) {
    console.log("screenshot: could not start a browser. Run: npx playwright install chromium");
    console.log(`  (${String(e.message).split("\n")[0]})`);
    process.exit(1);
  }
  const written = [];
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      reducedMotion: args.reduced ? "reduce" : "no-preference",
      hasTouch: vp.width < 600,
    });
    const page = await ctx.newPage();
    for (const route of routes) {
      try {
        await page.goto(args.url + route, { waitUntil: "load", timeout: 30000 });
      } catch {
        console.log(`screenshot: cannot reach ${args.url}${route}. Is the site running?`);
        await browser.close();
        process.exit(1);
      }
      // Scroll down in steps so scroll-triggered reveals play, then return to the top.
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y < height; y += vp.height * 0.7) {
        await page.evaluate((top) => window.scrollTo(0, top), y);
        await page.waitForTimeout(150);
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(1600);
      const file = path.join(outDir, shotName(route, vp.name));
      await page.screenshot({ path: file, fullPage: true });
      written.push(path.relative(args.cwd, file));
    }
    await ctx.close();
  }
  await browser.close();
  console.log(
    `screenshot: wrote ${written.length} files${args.reduced ? " (reduced motion)" : ""}`,
  );
  for (const f of written.slice(0, 30)) console.log(`  ${f}`);
}

// realpathSync: a script reached through a symlinked folder must still count as the entry point.
if (process.argv[1] && import.meta.url === pathToFileURL(realpathSync(process.argv[1])).href)
  main();
