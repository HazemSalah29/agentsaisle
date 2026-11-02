// whisper.cpp helpers for video-edit: the argument list, the JSON reader and the model lookup. These functions
// are copied unchanged from video-voice/scripts/align.mjs (the one place that knows whisper-cli's flags); a test
// checks both copies give the same answers. Nothing here starts a program.
import { readFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

/** The DTW preset whisper.cpp wants for a model file (ggml-base.bin -> "base"), or null for an unknown name. */
export function dtwPreset(model) {
  const m = /^ggml-(tiny|base|small|medium|large-v[123](?:-turbo)?)(\.en)?(?:-q\d\w*)?\.bin$/.exec(
    path.basename(model),
  );
  if (!m) return null;
  return (
    m[1].replace(/^large-v(\d)-turbo$/, "large.v$1.turbo").replace(/^large-v(\d)$/, "large.v$1") +
    (m[2] ?? "")
  );
}

/**
 * whisper-cli arguments. The one place that knows its flags (checked against whisper.cpp v1.9.5).
 * With a known model, DTW token timestamps are used (`-dtw <preset> -nfa`): in a test on 52 words they were
 * far closer than the per-word segment times (`-ml 1`), which stay as the fallback for unknown models.
 */
export const whisperArgs = ({ model, wav, lang, outPrefix }) => {
  const preset = dtwPreset(model);
  const common = ["-m", model, "-f", wav, "-l", lang];
  return preset
    ? [...common, "-dtw", preset, "-nfa", "-ojf", "-of", outPrefix]
    : [...common, "-ml", "1", "-sow", "-oj", "-of", outPrefix];
};

const isMarker = (t) => /^\s*[[(].*[\])]\s*$/.test(t) || /^\[_/.test(t.trim());

/**
 * Words (seconds) from whisper.cpp JSON. With DTW (`tokens[].t_dtw` in hundredths of a second) a word ends at its
 * last token's DTW time and starts where the previous word ended. Otherwise one entry per word (`-ml 1`),
 * pieces without a leading space joining the word before.
 */
export function parseWhisperJson(json) {
  const out = [];
  const segs = json?.transcription ?? [];
  const dtw = segs.some((e) => (e.tokens ?? []).some((t) => (t.t_dtw ?? -1) > 0));
  if (dtw) {
    for (const e of segs)
      for (const t of e.tokens ?? []) {
        const text = String(t.text ?? "");
        if (isMarker(text) || !text.trim() || !(t.t_dtw > 0)) continue;
        const end = t.t_dtw / 100;
        if (out.length && !/^\s/.test(text)) {
          out[out.length - 1].text += text;
          out[out.length - 1].end = Math.max(out[out.length - 1].end, end);
        } else
          out.push({
            text: text.trim(),
            start: out.length ? out[out.length - 1].end : (t.offsets?.from ?? 0) / 1000,
            end,
          });
      }
    return out.filter((w) => /[\p{L}\p{N}]/u.test(w.text) && w.end >= w.start);
  }
  for (const e of segs) {
    const text = String(e.text ?? "");
    if (isMarker(text) || !text.trim()) continue;
    const from = (e.offsets?.from ?? 0) / 1000;
    const to = (e.offsets?.to ?? 0) / 1000;
    if (out.length && !/^\s/.test(text)) {
      const last = out[out.length - 1];
      last.text += text;
      last.end = to;
    } else out.push({ text: text.trim(), start: from, end: to });
  }
  return out;
}

/** Where tools.json says the whisper model is, if anywhere. */
export function configuredModel(home = os.homedir()) {
  try {
    const m = JSON.parse(
      readFileSync(path.join(home, ".aisle-video", "tools.json"), "utf8"),
    )?.whisperModel;
    return typeof m === "string" && path.isAbsolute(m) ? m : null;
  } catch {
    return null;
  }
}
