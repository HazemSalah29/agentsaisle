// lint-skills: allow-network (provider API calls only; media bytes are written to disk, never run)
// Generation providers behind one interface: generate({ kind, prompt, seed, refs, seconds, aspect, model }, ctx)
// returns { bytes, ext, model }. "test" is offline and free (a gradient PNG, a short MP4 made with ffmpeg through
// the runner). The network adapters talk only to their one documented host with fetch, read the key from the
// environment, and only ever write the returned media bytes to disk; nothing downloaded is run.
// Every endpoint, field name and model id below is written from memory of the public docs and is marked
// TODO(verify): the docs were not reachable when this was written. Check them before the first paid call.
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

const MIME = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
};
const mimeOf = (f) => MIME[path.extname(f).toLowerCase()] ?? null;
const b64 = (file) => readFileSync(file).toString("base64");
const need = (env, name) => {
  const v = env[name];
  if (!v) throw new Error(`Set ${name} in the environment (never in a file).`);
  return v;
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

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

const GEMINI_HOST = "generativelanguage.googleapis.com";
const geminiBase = `https://${GEMINI_HOST}/v1beta`;

/** Gemini image generation (TODO(verify): path, model id, and field names). Reference images go in as inline data. */
const geminiImage = {
  adapter: "gemini-image",
  kinds: ["image"],
  license: "Google Gemini API terms (TODO(verify) commercial use and watermark rules)",
  async generate({ prompt, refs = [], model }, { env, fetch }) {
    const key = need(env, "GEMINI_API_KEY");
    const parts = [{ text: prompt }];
    for (const f of refs) {
      const mime = mimeOf(f);
      if (!mime)
        throw new Error(`Reference "${path.basename(f)}" is not a png, jpg or webp image.`);
      parts.push({ inline_data: { mime_type: mime, data: b64(f) } });
    }
    const res = await fetch(`${geminiBase}/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": key },
      body: JSON.stringify({
        contents: [{ parts }],
        generationConfig: { responseModalities: ["IMAGE"] },
      }),
    });
    if (!res.ok) throw new Error(`Image request failed: HTTP ${res.status}`);
    const json = await res.json();
    const part = (json?.candidates?.[0]?.content?.parts ?? []).find(
      (p) => (p.inlineData ?? p.inline_data)?.data,
    );
    const inline = part && (part.inlineData ?? part.inline_data);
    if (!inline)
      throw new Error("The provider returned no image (it may have declined the prompt).");
    const mime = inline.mimeType ?? inline.mime_type ?? "image/png";
    return {
      bytes: Buffer.from(inline.data, "base64"),
      ext: mime.includes("jpeg") ? ".jpg" : ".png",
      model,
    };
  },
};

/** Veo image-to-video through the Gemini API (TODO(verify): long-running operation shape and download URI). */
const veoVideo = {
  adapter: "veo",
  kinds: ["video"],
  license:
    "Google Veo / Gemini API terms (TODO(verify) commercial use; outputs carry a SynthID watermark)",
  async generate(
    { prompt, refs = [], seconds = 4, aspect = "9:16", model },
    { env, fetch, pollMs = 10_000, maxPolls = 60 },
  ) {
    const key = need(env, "GEMINI_API_KEY");
    const headers = { "content-type": "application/json", "x-goog-api-key": key };
    const instance = { prompt };
    if (refs[0]) {
      const mime = mimeOf(refs[0]);
      if (!mime)
        throw new Error(`Start frame "${path.basename(refs[0])}" is not a png, jpg or webp image.`);
      instance.image = { bytesBase64Encoded: b64(refs[0]), mimeType: mime };
    }
    const start = await fetch(`${geminiBase}/models/${model}:predictLongRunning`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        instances: [instance],
        parameters: { aspectRatio: aspect, durationSeconds: seconds },
      }),
    });
    if (!start.ok) throw new Error(`Video request failed: HTTP ${start.status}`);
    const op = await start.json();
    if (!/^[A-Za-z0-9/_.-]+$/.test(op?.name ?? ""))
      throw new Error("The provider returned no operation name.");
    for (let i = 0; i < maxPolls; i++) {
      const poll = await fetch(`${geminiBase}/${op.name}`, { headers });
      if (!poll.ok) throw new Error(`Video status check failed: HTTP ${poll.status}`);
      const s = await poll.json();
      if (s.error)
        throw new Error(
          `The provider reported an error: ${String(s.error.message ?? "").slice(0, 200)}`,
        );
      if (s.done) {
        const uri = s.response?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;
        if (!uri)
          throw new Error("The provider returned no video (it may have declined the prompt).");
        const u = new URL(uri);
        if (u.protocol !== "https:" || u.hostname !== GEMINI_HOST)
          throw new Error(
            `Refused to download from ${u.hostname}: only ${GEMINI_HOST} is allowed.`,
          );
        const dl = await fetch(uri, { headers: { "x-goog-api-key": key } });
        if (!dl.ok) throw new Error(`Video download failed: HTTP ${dl.status}`);
        return { bytes: Buffer.from(await dl.arrayBuffer()), ext: ".mp4", model };
      }
      await sleep(pollMs);
    }
    throw new Error(
      "Timed out waiting for the video. Nothing was charged by this script; check your provider console.",
    );
  },
};

export const ADAPTERS = { test: testProvider, "gemini-image": geminiImage, veo: veoVideo };
/** Kinds the CLI names but this version does not build. */
export const UNBUILT = ["music", "sfx", "lipsync"];
