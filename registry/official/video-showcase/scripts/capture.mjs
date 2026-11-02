#!/usr/bin/env node
// Plays a demo script on the user's own app with a headless browser and records the screen plus an interaction
// log (where and when each click, typing and scroll happened). The browser library is the user's own install in
// ~/.aisle-video (this script never installs or downloads anything). By default only localhost can be recorded
// and requests to other addresses are blocked, so the page cannot pull in anything from elsewhere.
// Usage: node capture.mjs --url http://localhost:3000 --script demo.md --out <folder> [--viewport 1280x720]
//          [--own-site --rights "<why you may record this site>"] [--browser <chrome executable>]
// Writes <folder>/capture.webm and <folder>/interaction-log.json. Exit: 0 done, 2 refused or failed.
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
import {
  PINNED_PLAYWRIGHT,
  checkUrl,
  entryUrl,
  parseViewport,
  resolvePlaywright,
  sensitiveTarget,
} from "./_capture.mjs";
import { parseDemo } from "./_demo.mjs";
import { capLines, isEntry, parseArgs } from "./_lib.mjs";
import { scrubEnv } from "./run.mjs";

const TARGET_WAIT_MS = 8000;
const r3 = (n) => Math.round(n * 1000) / 1000;
const unit = (v) => r3(Math.min(1, Math.max(0, v)));
const TYPE_DELAY_MS = 60;
const SCROLL_STEP = 120;

/** Run the steps against `page`; returns the interaction events. `now()` is seconds since the page was created. */
export async function perform(steps, { page, origin, viewport, now, sleep }) {
  const events = [];
  const find = (s) =>
    s.css ? page.locator(s.css).first() : page.getByText(s.text, { exact: false }).first();
  const box = async (s) => {
    const loc = find(s);
    try {
      await loc.waitFor({ timeout: TARGET_WAIT_MS });
      await loc.scrollIntoViewIfNeeded();
    } catch {
      throw new Error(
        `line ${s.line}: could not find ${s.css ?? `"${s.text}"`} within ${TARGET_WAIT_MS / 1000} s`,
      );
    }
    const b = await loc.boundingBox();
    if (!b) throw new Error(`line ${s.line}: ${s.css ?? `"${s.text}"`} has no size on the page`);
    return { loc, x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height };
  };
  const at = (b) => ({
    x: unit(b.x / viewport.w),
    y: unit(b.y / viewport.h),
    w: unit(b.w / viewport.w),
    h: unit(b.h / viewport.h),
  });
  for (const s of steps) {
    if (s.op === "go") {
      events.push({ t: r3(now()), kind: "go", path: s.path });
      await page.goto(new URL(s.path, origin).href, { waitUntil: "load" });
    } else if (s.op === "say") {
      events.push({ t: r3(now()), kind: "say", id: s.id });
    } else if (s.op === "wait") {
      const t = now();
      await sleep(s.seconds * 1000);
      events.push({ t: r3(t), end: r3(now()), kind: "wait" });
    } else if (s.op === "hover" || s.op === "click") {
      if (sensitiveTarget(s))
        throw new Error(`line ${s.line}: refused, the target looks like a secret field.`);
      const b = await box(s);
      await page.mouse.move(b.x, b.y, { steps: 20 });
      events.push({ t: r3(now()), kind: s.op, ...at(b) });
      if (s.op === "click") await page.mouse.click(b.x, b.y);
      await sleep(300);
    } else if (s.op === "type") {
      if (sensitiveTarget(s))
        throw new Error(
          `line ${s.line}: refused, typing into a secret field is never recorded. Use a normal field with dummy text.`,
        );
      const b = await box(s);
      await page.mouse.move(b.x, b.y, { steps: 20 });
      await page.mouse.click(b.x, b.y);
      const t = now();
      await b.loc.pressSequentially(s.value, { delay: TYPE_DELAY_MS });
      events.push({ t: r3(t), end: r3(now()), kind: "type", chars: s.value.length, ...at(b) });
      await sleep(300);
    } else if (s.op === "scroll") {
      const t = now();
      const sign = s.dir === "down" ? 1 : -1;
      for (let done = 0; done < s.px; done += SCROLL_STEP) {
        await page.mouse.wheel(0, sign * Math.min(SCROLL_STEP, s.px - done));
        await sleep(16);
      }
      events.push({ t: r3(t), end: r3(now()), kind: "scroll", x: 0.5, y: 0.5 });
      await sleep(300);
    }
  }
  return events;
}

/** Everything a run needs, with the browser library injectable so tests need no browser. */
export async function execute(argv, { load } = {}) {
  const { flags } = parseArgs(argv, {
    booleans: ["own-site", "force"],
    strings: ["url", "script", "out", "viewport", "rights", "browser"],
  });
  if (!flags.url || !flags.script || !flags.out) throw new Error("Give --url, --script and --out.");
  const target = checkUrl(flags.url, { own: flags["own-site"], rights: flags.rights });
  const viewport = parseViewport(flags.viewport);
  const demo = parseDemo(readFileSync(path.resolve(flags.script), "utf8"));
  if (demo.problems.length)
    throw new Error(`The demo script has problems:\n- ${demo.problems.slice(0, 8).join("\n- ")}`);

  const out = path.resolve(flags.out);
  const webm = path.join(out, "capture.webm");
  const logFile = path.join(out, "interaction-log.json");
  for (const f of [webm, logFile])
    if (existsSync(f) && !flags.force)
      throw new Error(`${path.basename(f)} already exists; use --force to replace it.`);

  let pw;
  if (load) pw = await load();
  else {
    const found = resolvePlaywright();
    if (!found)
      throw new Error(
        "playwright-core is not installed for the studio. Install it yourself, then run again:\n  npm install --prefix ~/.aisle-video playwright-core\n(see docs/video/USER_GUIDE.md). Or record your screen and use --recording with plan.mjs.",
      );
    const mod = await import(entryUrl(found.entry));
    pw = mod.chromium ? mod : mod.default;
    if (PINNED_PLAYWRIGHT !== "unset" && found.version !== PINNED_PLAYWRIGHT)
      console.error(
        `note: playwright-core ${found.version} found; tested with ${PINNED_PLAYWRIGHT}.`,
      );
  }

  mkdirSync(out, { recursive: true });
  const tmp = path.join(out, ".capture-tmp");
  rmSync(tmp, { recursive: true, force: true });
  let browser;
  try {
    browser = await pw.chromium.launch({
      headless: true,
      env: scrubEnv(process.env), // the browser never sees API keys
      ...(flags.browser ? { executablePath: path.resolve(flags.browser) } : {}),
    });
    const context = await browser.newContext({
      viewport: { width: viewport.w, height: viewport.h },
      deviceScaleFactor: 1,
      recordVideo: { dir: tmp, size: { width: viewport.w, height: viewport.h } },
      serviceWorkers: "block",
    });
    if (target.local)
      await context.route("**/*", (route) => {
        const u = route.request().url();
        return /^(data|blob|about):/.test(u) || new URL(u).origin === target.origin
          ? route.continue()
          : route.abort();
      });
    const page = await context.newPage();
    const t0 = Date.now();
    const now = () => (Date.now() - t0) / 1000;
    const sleep = (ms) => page.waitForTimeout(ms);
    const events = await perform(demo.steps, { page, origin: target.origin, viewport, now, sleep });
    await sleep(600);
    const duration = r3(now());
    const video = page.video();
    await context.close(); // the video file is finished when the context closes
    renameSync(await video.path(), webm);
    writeFileSync(
      logFile,
      `${JSON.stringify({ version: 1, origin: target.origin, rights: target.rights, viewport, duration, events }, null, 2)}\n`,
    );
    return [
      `recorded ${duration}s of ${target.origin} at ${viewport.w}x${viewport.h}`,
      `events: ${events.length} (${events.filter((e) => e.kind === "click").length} clicks, ${events.filter((e) => e.kind === "type").length} typing)`,
      `wrote ${path.basename(webm)} and ${path.basename(logFile)}`,
    ];
  } catch (e) {
    rmSync(webm, { force: true }); // never leave half a recording
    throw e;
  } finally {
    rmSync(tmp, { recursive: true, force: true });
    await browser?.close().catch(() => {});
  }
}

async function main() {
  try {
    console.log(
      capLines(await execute(process.argv.slice(2)), "Only this machine's app was recorded."),
    );
  } catch (e) {
    console.error(e.message);
    process.exit(2);
  }
}

if (isEntry(import.meta.url)) main();
