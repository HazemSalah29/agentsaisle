// The frame logic of the Remotion adapter, kept free of React and Remotion so it can be tested on its own.
// Copied into the generated project as src/runtime.js. A frame depends only on the clock `t` (in seconds).

/** True while a clip that starts at `start` and lasts `dur` seconds is on screen at `t`. */
export const clipVisible = (start, dur, t) => t >= start - 1e-6 && t < start + dur - 1e-6;

/**
 * Show or hide every timed clip under `root` for the time `t` and return the videos that are on screen with
 * the time each one should show: [{ el, time }]. A video follows the clip it sits in (or is itself).
 */
export function applyFrame(root, t) {
  const videos = [];
  for (const el of root.querySelectorAll(".clip[data-start]")) {
    const start = Number(el.getAttribute("data-start"));
    const dur = Number(el.getAttribute("data-duration"));
    el.style.visibility = clipVisible(start, dur, t) ? "visible" : "hidden";
  }
  for (const el of root.querySelectorAll("video")) {
    const clip = el.closest("[data-start]");
    if (!clip) continue;
    const start = Number(clip.getAttribute("data-start"));
    const dur = Number(clip.getAttribute("data-duration"));
    if (clipVisible(start, dur, t)) videos.push({ el, time: Math.max(0, t - start) });
  }
  return videos;
}

/** Resolve once a <video> shows `time` seconds. Rejects if the browser reports an error. */
export function seekVideo(el, time) {
  return new Promise((resolve, reject) => {
    const fail = () => reject(new Error(`video could not be read: ${el.getAttribute("src")}`));
    el.addEventListener("error", fail, { once: true });
    const go = () => {
      if (el.readyState >= 2 && Math.abs(el.currentTime - time) < 0.0005) return resolve();
      el.addEventListener("seeked", () => resolve(), { once: true });
      el.currentTime = time;
    };
    if (el.readyState >= 1) go();
    else el.addEventListener("loadedmetadata", go, { once: true });
  });
}
