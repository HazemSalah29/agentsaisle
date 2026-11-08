// motion.js: springs as pure functions of time, so frame(t) stays pure (no simulation, no state).
// Load with <script src="motion.js"></script> (copy it into the reel folder) or paste it into the page.
// Damping ratio zeta: 1 = no bounce, 0.7 to 0.85 = weighty, 0.4 to 0.6 = playful, under 0.3 = cartoon.
// f = speed in Hz (about 1.5 slow and heavy, 2 normal, 3 snappy). Position and size may bounce; opacity and colour never.
(function (g) {
  // 0 -> 1 progress of a spring that starts at time 0.
  function spring(t, zeta = 0.8, f = 2) {
    if (t <= 0) return 0;
    const w = 2 * Math.PI * f;
    if (zeta >= 1) return 1 - Math.exp(-w * t) * (1 + w * t);
    const wd = w * Math.sqrt(1 - zeta * zeta);
    return 1 - Math.exp(-zeta * w * t) * (Math.cos(wd * t) + (zeta * w / wd) * Math.sin(wd * t));
  }
  // A value that moves to several targets: keys = [[time, value], ...] in time order.
  // One spring per change, each from its own time, so a new target never restarts the motion.
  function track(t, keys, zeta = 0.8, f = 2) {
    let v = keys[0][1];
    for (let i = 1; i < keys.length; i++) v += (keys[i][1] - keys[i - 1][1]) * spring(t - keys[i][0], zeta, f);
    return v;
  }
  // Follow-through: a loose part (flame, chain, leaf) runs the same track `lag` seconds later and looser.
  function follow(t, keys, lag = 0.12, zeta = 0.5, f = 2) { return track(t - lag, keys, zeta, f); }
  // Camera shot (look.md, Camera and timing). Frames a target box {x, y, w, h} in world pixels so it fills
  // `fill` of the frame (about .9 close-up, .4 medium close-up; wide = scale 1). The world must be at least
  // the frame's size (W x H); the edge clamp means its edge never shows. Returns {s, tx, ty}: apply it as
  // ctx.setTransform(s, 0, 0, s, tx, ty) on the world layer only; captions stay on the screen layer.
  function frameOn(box, fill, W = 1080, H = 1920) {
    const s = Math.max(1, Math.min(W * fill / box.w, H * fill / box.h));
    return { s, fx: box.x + box.w / 2, fy: box.y + box.h / 2 };
  }
  function shot(cam, W = 1080, H = 1920, worldW = W, worldH = H) {
    const s = cam.s;
    const tx = Math.min(0, Math.max(W - worldW * s, W / 2 - cam.fx * s));
    const ty = Math.min(0, Math.max(H - worldH * s, H / 2 - cam.fy * s));
    return { s, tx, ty };
  }
  g.Motion = { spring, track, follow, frameOn, shot };
})(typeof window !== 'undefined' ? window : globalThis);
