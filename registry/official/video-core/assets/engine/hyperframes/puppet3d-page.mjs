// Runs inside the rendered page (not in node): draws the 3D puppet scenes with three.js. It builds characters
// and backdrops from plain data (the rig and the per-frame pose samples made by puppet3d.mjs), never loads a
// model, texture or script, and draws a frame as a pure function of the clock, so HyperFrames can seek anywhere.
import * as T from "./three.mjs";

const CHANNELS = 14; // x, lift, yaw, sx, sy, bob, head, armL, armR, legL, legR, brows, closed, mouth
const MOUTHS = ["rest", "a", "e", "o", "u", "mbp", "fv", "l"];
const RAD = Math.PI / 180;
const VIEW = { fov: 30, from: [0, 3, 14], pitch: 8 * RAD };

/** A box with rounded edges and corners: a subdivided box with each vertex pulled to `r` from the inner box. */
function roundedBox(w, h, d, r) {
  const g = new T.BoxGeometry(w, h, d, 10, 10, 10);
  const p = g.attributes.position;
  const half = [w / 2 - r, h / 2 - r, d / 2 - r].map((v) => Math.max(0, v));
  const v = new T.Vector3();
  const inner = new T.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    inner.set(
      Math.max(-half[0], Math.min(half[0], v.x)),
      Math.max(-half[1], Math.min(half[1], v.y)),
      Math.max(-half[2], Math.min(half[2], v.z)),
    );
    const dir = v.sub(inner);
    if (dir.lengthSq() > 0) dir.normalize().multiplyScalar(r);
    p.setXYZ(i, inner.x + dir.x, inner.y + dir.y, inner.z + dir.z);
  }
  g.computeVertexNormals();
  return g;
}

/** A rounded cone: a dome at the bottom that narrows to a soft tip. Radius R, height h. */
function droplet(R, h) {
  const pts = [];
  for (let i = 0; i <= 28; i++) {
    const u = i / 28;
    const r =
      u < 0.35
        ? R * Math.sqrt(Math.max(0, 1 - ((u - 0.35) / 0.35) ** 2))
        : R * Math.cos(((u - 0.35) / 0.65) * (Math.PI / 2)) ** 1.1;
    pts.push(new T.Vector2(Math.max(0.0001, r), (u - 0.5) * h));
  }
  return new T.LatheGeometry(pts, 40);
}

function geometryFor(p) {
  const [a, b, c] = p.size;
  switch (p.shape) {
    case "sphere":
      return [new T.SphereGeometry(1, 48, 32), [a, b, c]];
    case "capsule":
      return [new T.CapsuleGeometry(a, b, 12, 24), [1, 1, c]];
    case "box":
      return [roundedBox(a, b, c, Math.min(p.radius ?? 0.05, a / 2, b / 2, c / 2)), [1, 1, 1]];
    case "droplet":
      return [droplet(a, b), [1, 1, c]];
    default:
      return [new T.CylinderGeometry(a, a, b, 32), [1, 1, c]];
  }
}

function makeMaterial(m) {
  const opacity = m.opacity ?? 1;
  return new T.MeshPhysicalMaterial({
    color: m.color,
    roughness: m.roughness ?? 0.5,
    metalness: m.metalness ?? 0,
    clearcoat: m.clearcoat ?? 0,
    clearcoatRoughness: 0.35,
    sheen: m.sheen ?? 0,
    sheenRoughness: 0.6,
    sheenColor: new T.Color("#ffffff"),
    emissive: new T.Color(m.emissive ?? "#000000"),
    transparent: opacity < 1,
    opacity,
  });
}

/** One character as a tree of groups (one per part, turning around its pivot); returns its root and parts by id. */
function buildCharacter(rig) {
  const mats = Object.fromEntries(
    Object.entries(rig.materials).map(([k, m]) => [k, makeMaterial(m)]),
  );
  const root = new T.Group();
  const parts = {};
  for (const p of rig.parts) {
    const g = new T.Group();
    g.position.set(...p.pivot);
    if (p.shape && p.shape !== "none") {
      const [geo, scale] = geometryFor(p);
      const mesh = new T.Mesh(geo, mats[p.material]);
      mesh.scale.set(...scale);
      if (p.position) mesh.position.set(...p.position);
      if (p.rotation) mesh.rotation.set(...p.rotation.map((d) => d * RAD));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      g.add(mesh);
    }
    parts[p.id] = { group: g, home: g.position.clone() };
  }
  // Attach after every part exists, so the list may name a parent before it is defined.
  for (const p of rig.parts) (p.parent ? parts[p.parent].group : root).add(parts[p.id].group);
  for (const id of ["eyes-closed", ...MOUTHS.slice(1).map((m) => `mouth-${m}`)])
    parts[id].group.visible = false;
  return { root, parts };
}

/** Deterministic pseudo-random numbers, so scattered flowers and stars are the same on every render. */
function lcg(seed) {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 4294967296;
}

const lambert = (color, o = {}) => new T.MeshPhysicalMaterial({ color, roughness: 0.9, ...o });
const glow = (color) => new T.MeshBasicMaterial({ color });
function blob(geo, mat, x, y, z, sx = 1, sy = 1, sz = 1, shadow = false) {
  const m = new T.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = shadow;
  m.receiveShadow = true;
  return m;
}

/** Original backdrops built from simple shapes. Returns { drift(t01) } for the slowly moving parts. */
function buildBackdrop(scene, preset) {
  const S = new T.SphereGeometry(1, 40, 24);
  const drifters = [];
  const ground = (color, size = 90) => {
    const g = blob(new T.CircleGeometry(size, 64), lambert(color, { roughness: 0.95 }), 0, 0, 0);
    g.rotation.x = -Math.PI / 2;
    scene.add(g);
  };
  const sky = (color, near, far) => {
    scene.background = new T.Color(color);
    scene.fog = new T.Fog(color, near, far);
  };
  if (preset === "room") {
    sky("#ffe3b8", 40, 120);
    const wall = blob(new T.PlaneGeometry(60, 24), lambert("#ffe3b8"), 0, 8, -7);
    wall.receiveShadow = false;
    scene.add(wall);
    ground("#d9a066");
    const box = new T.BoxGeometry(1, 1, 1);
    scene.add(blob(box, lambert("#c98b4a"), 2.6, 5.4, -6.9, 4.6, 5.2, 0.2));
    scene.add(blob(box, glow("#8fd3ff"), 2.6, 5.4, -6.78, 4.0, 4.6, 0.1));
    scene.add(blob(box, lambert("#ffffff"), 2.6, 5.4, -6.7, 0.18, 4.6, 0.1));
    scene.add(blob(box, lambert("#ffffff"), 2.6, 5.4, -6.7, 4.0, 0.18, 0.1));
    scene.add(
      blob(new T.CylinderGeometry(1, 1, 0.06, 48), lambert("#e86a5f"), 0, 0.03, -0.4, 5, 1, 3),
    );
    scene.add(blob(box, lambert("#a8703a"), -4.4, 2.4, -5.6, 3.4, 0.2, 1.2, true));
    scene.add(blob(box, lambert("#5aa9e6"), -5.4, 3.1, -5.6, 0.9, 1.2, 0.9, true));
    scene.add(blob(box, lambert("#ffd166"), -4.4, 3.0, -5.6, 0.8, 0.8, 0.8, true));
    scene.add(blob(box, lambert("#7bd389"), -3.4, 3.2, -5.6, 0.9, 1.3, 0.9, true));
    scene.add(blob(box, lambert("#a8703a"), -4.4, 1.1, -6.2, 0.2, 2.2, 0.2));
    return { drift() {}, hemi: ["#fff1d6", "#a8703a", 1.0], sun: ["#fff3d6", 2.2] };
  }
  const night = preset === "night";
  sky(night ? "#1b2a5c" : "#8fd3ff", 30, night ? 90 : 110);
  ground(night ? "#1d2f55" : "#43b05a");
  const hill = night ? ["#2e4a7d", "#233a66"] : ["#9be39b", "#6ccb73"];
  [
    [-14, -2.5, -34, 16, 7, 8, 0],
    [10, -2.5, -38, 20, 8, 9, 0],
    [-4, -2, -24, 12, 4.5, 6, 1],
    [14, -2, -22, 14, 5, 6, 1],
  ].forEach(([x, y, z, sx, sy, sz, k]) =>
    scene.add(blob(S, lambert(hill[k]), x, y, z, sx, sy, sz)),
  );
  if (night) {
    scene.add(blob(S, glow("#f4f0d2"), 7, 11, -46, 2.6, 2.6, 2.6));
    const rnd = lcg(7);
    const pos = [];
    for (let i = 0; i < 90; i++) pos.push((rnd() - 0.5) * 70, 6 + rnd() * 22, -48);
    const g = new T.BufferGeometry();
    g.setAttribute("position", new T.Float32BufferAttribute(pos, 3));
    const stars = new T.Points(
      g,
      new T.PointsMaterial({ color: "#fff6c9", size: 0.35, fog: false }),
    );
    scene.add(stars);
    drifters.push([stars, 1.2]);
    return {
      drift: (u) => drifters.forEach(([o, d]) => (o.position.x = (u - 0.5) * 2 * d)),
      hemi: ["#6f86c9", "#1d2f55", 0.7],
      sun: ["#9db4ff", 1.4],
    };
  }
  scene.add(blob(S, glow("#ffd84d"), -9, 12, -50, 3.2, 3.2, 3.2));
  const rnd = lcg(11);
  for (let i = 0; i < 6; i++) {
    const cloud = new T.Group();
    const n = 3 + Math.floor(rnd() * 2);
    for (let k = 0; k < n; k++)
      cloud.add(
        blob(
          S,
          lambert("#ffffff", { roughness: 1, emissive: new T.Color("#9fb7c9") }),
          k * 1.6 - n * 0.8,
          rnd() * 0.5,
          rnd() * 0.6,
          2.1,
          1.1,
          1.4,
        ),
      );
    cloud.position.set(-22 + i * 9, 10 + rnd() * 6, -36 - rnd() * 8);
    scene.add(cloud);
    drifters.push([cloud, 2 + rnd() * 3, cloud.position.x]);
  }
  const colors = ["#ff7aa2", "#ffe066", "#ffffff", "#b58cff"];
  const fr = lcg(5);
  for (let i = 0; i < 40; i++) {
    const x = (fr() - 0.5) * 24;
    const z = -9 + fr() * 12;
    scene.add(blob(S, lambert(colors[i % 4]), x, 0.12, z, 0.14, 0.14, 0.14));
  }
  for (const x of [-8.5, 9]) {
    scene.add(
      blob(
        new T.CylinderGeometry(0.35, 0.45, 3, 16),
        lambert("#8a5a2b"),
        x,
        1.5,
        -10,
        1,
        1,
        1,
        true,
      ),
    );
    scene.add(blob(S, lambert("#3e9a4d"), x, 4.6, -10, 2.2, 2.2, 2.2, true));
  }
  return {
    drift: (u) => drifters.forEach(([o, d, x0 = 0]) => (o.position.x = x0 + (u - 0.5) * 2 * d)),
    hemi: ["#cfe8ff", "#4a7a45", 1.1],
    sun: ["#fff3d6", 2.6],
  };
}

/** Where a point of the screen (0 to 1 across and down) lands on the ground (y = 0), and how big the view is there. */
function groundPoint(camera, xf, yf, aspect) {
  const ndc = new T.Vector3(xf * 2 - 1, -(yf * 2 - 1), 0.5).unproject(camera);
  const from = camera.position;
  const dir = ndc.sub(from).normalize();
  const dist = -from.y / dir.y;
  const point = from.clone().add(dir.clone().multiplyScalar(dist));
  const forward = new T.Vector3(0, 0, -1).applyQuaternion(camera.quaternion);
  const depth = point.clone().sub(from).dot(forward);
  const viewH = 2 * depth * Math.tan((VIEW.fov * RAD) / 2);
  return { point, viewH, viewW: viewH * aspect };
}

function makeScene(spec, canvas) {
  const [w, h] = spec.size;
  const renderer = new T.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(w, h, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  const scene = new T.Scene();
  const camera = new T.PerspectiveCamera(VIEW.fov, w / h, 0.1, 200);
  camera.position.set(...VIEW.from);
  camera.rotation.x = -VIEW.pitch;
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();
  const back = buildBackdrop(scene, spec.backdrop);
  const hemi = new T.HemisphereLight(back.hemi[0], back.hemi[1], back.hemi[2]);
  scene.add(hemi);
  const sun = new T.DirectionalLight(back.sun[0], back.sun[1]);
  sun.position.set(-5, 11, 9);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  sun.shadow.radius = 5;
  Object.assign(sun.shadow.camera, {
    left: -11,
    right: 11,
    top: 11,
    bottom: -11,
    near: 1,
    far: 40,
  });
  scene.add(sun);
  scene.add(sun.target);
  const cast = spec.cast.map((c) => {
    const built = buildCharacter(c.rig);
    scene.add(built.root);
    const at = groundPoint(camera, c.x, c.y, w / h);
    const scale = (c.height * at.viewH) / c.rig.height;
    return { ...built, c, at, scale, h: c.rig.height * scale };
  });
  return { renderer, scene, camera, cast, back };
}

function sampleAt(c, t, fps) {
  const f = Math.max(0, Math.min(c.n - 1, t * fps));
  const i = Math.floor(f);
  const j = Math.min(c.n - 1, i + 1);
  const k = f - i;
  const out = new Array(CHANNELS);
  for (let m = 0; m < CHANNELS - 1; m++) {
    const a = c.samples[i * CHANNELS + m];
    out[m] = a + (c.samples[j * CHANNELS + m] - a) * k;
  }
  out[CHANNELS - 1] = c.samples[i * CHANNELS + CHANNELS - 1];
  return out;
}

function drawFrame(state, spec, t) {
  const { renderer, scene, camera, cast, back } = state;
  back.drift(Math.min(1, t / spec.seconds));
  for (const ch of cast) {
    const s = sampleAt(ch.c, t, spec.fps);
    const [x, lift, yaw, sx, sy, bob, head, armL, armR, legL, legR, brows, closed, mouth] = s;
    ch.root.position.set(
      ch.at.point.x + (x - ch.c.x) * ch.at.viewW,
      lift * ch.at.viewH + bob * ch.h,
      ch.at.point.z,
    );
    ch.root.scale.set(ch.scale * sx, ch.scale * sy, ch.scale * sx);
    ch.root.rotation.y = yaw;
    const turn = (id, deg) => (ch.parts[id].group.rotation.z = -deg * RAD);
    turn("head", head);
    turn("arm-l", armL);
    turn("arm-r", armR);
    turn("leg-l", legL);
    turn("leg-r", legR);
    const br = ch.parts.brows;
    if (br) br.group.position.y = br.home.y - (brows / 400) * ch.c.rig.height;
    ch.parts["eyes-closed"].group.visible = closed > 0.5;
    ch.parts["eyes-open"].group.visible = closed <= 0.5;
    MOUTHS.forEach((m, k) => (ch.parts[`mouth-${m}`].group.visible = k === Math.round(mouth)));
  }
  renderer.render(scene, camera);
}

/**
 * Wrap the film's timeline so each 3D scene is drawn when the clock is inside it. `specs` come from puppet3d.mjs.
 * The 2D animations keep running on the original timeline; this only adds the canvases.
 */
export function mount(tl, specs) {
  const states = new Map();
  const original = tl.time;
  tl.time = function (t) {
    const r = original.call(tl, t);
    if (t === undefined) return r;
    for (const spec of specs) {
      if (t < spec.at - 1e-6 || t >= spec.at + spec.seconds) continue;
      let st = states.get(spec.id);
      if (!st) {
        st = makeScene(spec, document.getElementById(spec.id));
        states.set(spec.id, st);
      }
      drawFrame(st, spec, t - spec.at);
    }
    return tl;
  };
  return tl;
}
