// Generation providers behind one interface: generate({ kind, prompt, seed, refs, seconds, aspect, model }, ctx)
// returns { bytes, ext, model }. Only "test" is built in: offline and free (a gradient PNG, a short MP4 made with
// ffmpeg through the runner). Real AI images and clips come from the Higgsfield connector in Claude and are listed
// with adopt.mjs; this skill has no network adapter and holds no key.
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { deflateSync } from "node:zlib";

const sha = (s) => createHash("sha256").update(s).digest();
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, "latin1"), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};

/** A deterministic RGB gradient PNG whose colours come from the prompt and seed. */
export function testPng(prompt, seed, w = 320, h = 180) {
  const d = sha(`${prompt}\0${seed}`);
  const raw = Buffer.alloc((w * 3 + 1) * h);
  for (let y = 0; y < h; y++) {
    const row = y * (w * 3 + 1);
    for (let x = 0; x < w; x++)
      for (let c = 0; c < 3; c++)
        raw[row + 1 + x * 3 + c] = Math.round(
          d[c] * (1 - x / w) * 0.6 + d[c + 3] * (y / h) * 0.6 + 40,
        );
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const testProvider = {
  adapter: "test",
  kinds: ["image", "video"],
  free: true,
  license: "none (generated test media, not a real model)",
  async generate({ kind, prompt, seed, seconds = 3 }, { run }) {
    const png = testPng(prompt, seed);
    if (kind === "image") return { bytes: png, ext: ".png", model: "test-gradient-1" };
    const tmp = mkdtempSync(path.join(os.tmpdir(), "video-generate-"));
    try {
      const img = path.join(tmp, "in.png");
      const out = path.join(tmp, "out.mp4");
      writeFileSync(img, png);
      const r = run("ffmpeg", [
        "-y",
        "-loglevel",
        "error",
        "-loop",
        "1",
        "-i",
        img,
        "-t",
        String(seconds),
        "-vf",
        "scale=320:180,format=yuv420p",
        "-r",
        "24",
        "-an",
        out,
      ]);
      if (r.error || r.status !== 0)
        throw new Error(
          `ffmpeg is needed for the test video provider: ${(r.stderr || r.error?.message || "").slice(0, 200)}`,
        );
      return { bytes: readFileSync(out), ext: ".mp4", model: "test-gradient-1" };
    } finally {
      rmSync(tmp, { recursive: true, force: true });
    }
  },
};

export const ADAPTERS = { test: testProvider };
/** Kinds the CLI names but this version does not build. */
export const UNBUILT = ["music", "sfx", "lipsync"];
