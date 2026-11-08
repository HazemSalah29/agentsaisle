// Sets for the ember figures, built entirely in code (textures from tex.js).
//   buildHall(scene, renderer)       a 1990 front hall: planks, runner, damask wallpaper, walnut dado, floor lamp, console table, a doorway
//   buildPlainRoom(scene, renderer)  one plaster room, one doorway, one lamp: the simplest set
// Both put the doorway in the back wall (z = ROOM.z0) with a dim lit corridor behind it, and the door leaf is a
// group hinged on its left edge that the page swings from t. Every animated handle is returned, so a page can
// reset it each frame. The floor is semi-transparent (opacity 0.84, renderOrder 2) so each figure's mirror copy
// shows through as a reflection: keep the floor at y = 0.
import * as THREE from 'three';
import { floorPlanks, walnut, wallpaper, rug, plaster, glow } from './tex.js';

export const HALL = { x0: -2, x1: 2, z0: -4, z1: 2.6, ceil: 2.7, door: { x: 0.35, w: 0.92, h: 2.08 }, lamp: new THREE.Vector3(-1.35, 1.5, -2.7) };
export const PLAIN = { x0: -2.2, x1: 2.2, z0: -4, z1: 3, ceil: 2.8, door: { x: 0, w: 0.95, h: 2.1 }, lamp: new THREE.Vector3(-1.5, 1.5, -2.3) };

function scaleUV(g, su, sv) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); return g; }
function boxGeo(w, h, d, tile = 0.6) {
  const g = new THREE.BoxGeometry(w, h, d), uv = g.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) { const i = f * 4 + k; uv.setXY(i, uv.getX(i) * dims[f][0] / tile, uv.getY(i) * dims[f][1] / tile); }
  return g;
}

function helpers(root) {
  const add = (m, cast = true, recv = true, parent = root) => { m.castShadow = cast; m.receiveShadow = recv; parent.add(m); return m; };
  const box = (w, h, d, mat, x, y, z, o = {}) => { const m = add(new THREE.Mesh(boxGeo(w, h, d, o.tile ?? 0.6), mat), o.cast ?? true, o.recv ?? true, o.parent ?? root); m.position.set(x, y, z); if (o.ry) m.rotation.y = o.ry; if (o.rx) m.rotation.x = o.rx; return m; };
  return { add, box };
}

function baseMaterials() {
  const w1 = walnut(5), w2 = walnut(21, { dark: 0.75 });
  return {
    trim: new THREE.MeshStandardMaterial({ map: w2.map, roughnessMap: w2.rough, roughness: 0.8 }),
    panel: new THREE.MeshStandardMaterial({ map: w1.map, roughnessMap: w1.rough, roughness: 0.9 }),
    door: new THREE.MeshStandardMaterial({ map: w2.map, roughnessMap: w2.rough, roughness: 0.7, color: 0xb08878 }),
    brass: new THREE.MeshStandardMaterial({ color: 0xc09a58, metalness: 1, roughness: 0.32 }),
    dark: new THREE.MeshStandardMaterial({ color: 0x1a1210, roughness: 0.8 }),
    cloth: new THREE.MeshStandardMaterial({ color: 0x2a221c, roughness: 1 }),
    ceil: new THREE.MeshStandardMaterial({ color: 0x8c7a62, roughness: 0.95, side: THREE.DoubleSide }),
  };
}

function floorMesh(root, add, R, M) {
  const fl = floorPlanks(3), FW = R.x1 - R.x0, FD = R.z1 - R.z0;
  M.floor = new THREE.MeshStandardMaterial({ map: fl.map, roughnessMap: fl.rough, roughness: 1, metalness: 0, transparent: true, opacity: 0.84, bumpMap: fl.rough, bumpScale: 0.6 });
  const floor = add(new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(FW, FD), FW / 2, FD / 2), M.floor), false, true);
  floor.rotation.x = -Math.PI / 2; floor.position.set((R.x0 + R.x1) / 2, 0, (R.z0 + R.z1) / 2); floor.renderOrder = 2;
  const ceil = add(new THREE.Mesh(new THREE.PlaneGeometry(FW, FD), M.ceil), false, true);
  ceil.rotation.x = Math.PI / 2; ceil.position.set((R.x0 + R.x1) / 2, R.ceil, (R.z0 + R.z1) / 2);
}

/** a four-wall shell; `mat` is the wall material, `uvTile` metres per texture repeat; the back wall has the doorway */
function walls(root, add, R, mat, uvTile) {
  const H = R.ceil, FD = R.z1 - R.z0, FW = R.x1 - R.x0, D = R.door;
  const wall = (len, h, x, y, z, ry) => { const m = add(new THREE.Mesh(scaleUV(new THREE.PlaneGeometry(len, h), len / uvTile, h / uvTile), mat), false, true); m.position.set(x, y, z); m.rotation.y = ry; return m; };
  wall(FD, H, R.x1, H / 2, (R.z0 + R.z1) / 2, -Math.PI / 2);
  wall(FD, H, R.x0, H / 2, (R.z0 + R.z1) / 2, Math.PI / 2);
  wall(FW, H, (R.x0 + R.x1) / 2, H / 2, R.z1, Math.PI);
  const dl = D.x - D.w / 2 - 0.02, dr = D.x + D.w / 2 + 0.02;
  wall(dl - R.x0, H, (R.x0 + dl) / 2, H / 2, R.z0, 0); wall(R.x1 - dr, H, (R.x1 + dr) / 2, H / 2, R.z0, 0); wall(dr - dl, H - D.h, D.x, (H + D.h) / 2, R.z0, 0);
  return { dl, dr };
}

/** door leaf hinged on its left edge (swing with leaf.rotation.y), casing, and a dim lit corridor behind the opening */
function doorway(root, add, box, R, M, dl, dr, panelled) {
  const D = R.door, hinge = D.x - D.w / 2;
  const leaf = new THREE.Group(); leaf.position.set(hinge, 0, R.z0 - 0.02); root.add(leaf);
  box(D.w, D.h, 0.045, M.door, D.w / 2, D.h / 2, 0, { parent: leaf, tile: 0.9 });
  if (panelled) for (let r = 0; r < 3; r++) for (let c = 0; c < 2; c++) {
    const ph = [0.42, 0.62, 0.62][r], py = [1.68, 1.08, 0.42][r];
    box(0.3, ph, 0.02, M.door, D.w / 2 + (c - 0.5) * 0.4, py, -0.03, { parent: leaf, tile: 0.9 });
    box(0.26, ph - 0.04, 0.012, M.trim, D.w / 2 + (c - 0.5) * 0.4, py, -0.045, { parent: leaf, tile: 0.9 });
  }
  const knob = add(new THREE.Mesh(new THREE.SphereGeometry(0.03, 20, 14), new THREE.MeshStandardMaterial({ color: 0x5a4628, metalness: 0.5, roughness: 0.8 })), true, true, leaf);
  knob.position.set(D.w - 0.07, 0.98, 0.06);
  box(0.09, D.h + 0.09, 0.03, M.trim, dl - 0.025, (D.h + 0.09) / 2, R.z0 + 0.02); box(0.09, D.h + 0.09, 0.03, M.trim, dr + 0.025, (D.h + 0.09) / 2, R.z0 + 0.02);
  box(dr - dl + 0.14, 0.1, 0.035, M.trim, D.x, D.h + 0.07, R.z0 + 0.02);
  // corridor behind the door: dark, with a warm glow panel at its end and a faint warm light, so a figure stands in a lit frame
  const cz = R.z0 - 1.2, cw = D.w + 0.5;
  const dk = new THREE.MeshStandardMaterial({ color: 0x241a16, roughness: 0.9 });
  for (const s of [-1, 1]) box(0.04, D.h + 0.3, 2.4, dk, D.x + s * cw / 2, (D.h + 0.3) / 2, cz, { cast: false });
  box(cw, 0.04, 2.4, dk, D.x, D.h + 0.15, cz, { cast: false });
  box(cw, 0.04, 2.4, dk, D.x, -0.02, cz, { cast: false });
  const end = new THREE.Mesh(new THREE.PlaneGeometry(cw, D.h + 0.3), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.72, 0.42).multiplyScalar(0.16) }));
  end.position.set(D.x, (D.h + 0.3) / 2, R.z0 - 2.38); root.add(end);
  const spill = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.9), new THREE.MeshBasicMaterial({ map: glow(256, 2.2), color: new THREE.Color(1, 0.72, 0.42).multiplyScalar(0.5), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  spill.rotation.x = -Math.PI / 2; spill.position.set(D.x, 0.008, R.z0 + 0.3); spill.renderOrder = 6; root.add(spill);
  const back = new THREE.PointLight(0xffc68c, 0.5, 0, 2); back.position.set(D.x, 2.0, R.z0 - 1.4); root.add(back);
  return { leaf, spill, back, end };
}

function floorLamp(root, add, p, shadeMat) {
  const g = new THREE.Group(); g.position.set(p.x, 0, p.z); root.add(g);
  const leg = new THREE.MeshStandardMaterial({ color: 0x3a2a1e, roughness: 0.8 });
  for (let k = 0; k < 3; k++) {
    const a = k * Math.PI * 2 / 3 + 0.3, l = add(new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.016, 1.36, 10), leg), true, true, g);
    l.position.set(Math.cos(a) * 0.14, 0.66, Math.sin(a) * 0.14); l.rotation.set(Math.sin(a) * 0.2, 0, -Math.cos(a) * 0.2);
  }
  const shade = add(new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.2, 0.28, 40, 1, true), shadeMat), false, false, g); shade.position.y = 1.52;
  const bulb = add(new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.85, 0.6).multiplyScalar(1.6) })), false, false, g); bulb.position.y = 1.45;
  const lamp = new THREE.PointLight(0xffcf95, 3.2, 0, 2); lamp.position.set(p.x, 1.47, p.z);
  lamp.castShadow = true; lamp.shadow.mapSize.set(1024, 1024); lamp.shadow.bias = -0.003; lamp.shadow.radius = 6; lamp.shadow.camera.near = 0.08; lamp.shadow.camera.far = 12;
  root.add(lamp);
  return lamp;
}

/** weak hemisphere fill + a PMREM environment from a dark box with one hot sphere at the lamp */
function lighting(scene, renderer, lampPos) {
  scene.add(new THREE.HemisphereLight(0x5a4030, 0x100806, 0.18));
  const pm = new THREE.PMREMGenerator(renderer), env = new THREE.Scene();
  env.add(new THREE.Mesh(new THREE.BoxGeometry(8, 6, 10), new THREE.MeshBasicMaterial({ color: 0x0c0806, side: THREE.BackSide })));
  const hot = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(1, 0.8, 0.55).multiplyScalar(3) }));
  hot.position.copy(lampPos); env.add(hot);
  scene.environment = pm.fromScene(env, 0.04).texture; scene.environmentIntensity = 0.35;
}

const shadeMaterial = () => new THREE.MeshStandardMaterial({ color: 0x2a2018, emissive: 0xf2e2be, emissiveIntensity: 0.45, side: THREE.DoubleSide, roughness: 1 });

/** The front hall. Returns { root, lamp, lampShade, tlamp, door, spill, back, M, ROOM }. */
export function buildHall(scene, renderer) {
  const R = HALL, root = new THREE.Group(); scene.add(root);
  const { add, box } = helpers(root), M = baseMaterials();
  M.paper = new THREE.MeshStandardMaterial({ map: wallpaper(7), roughness: 0.88 });
  M.rug = new THREE.MeshStandardMaterial({ map: rug(11), roughness: 0.97 });
  M.iron = new THREE.MeshStandardMaterial({ color: 0xc9bea8, roughness: 0.55 });
  floorMesh(root, add, R, M);
  const runner = add(new THREE.Mesh(new THREE.PlaneGeometry(1.1, 5.3), M.rug), false, true);
  runner.rotation.x = -Math.PI / 2; runner.position.set(0.35, 0.006, -0.7); runner.renderOrder = 3;
  const { dl, dr } = walls(root, add, R, M.paper, 0.5);

  // panelled walnut dado: backing + raised panels + cap rail + baseboard
  const WAIN = 0.95;
  const wains = (len, x, z, ry) => {
    const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = ry; root.add(g);
    box(len, WAIN, 0.02, M.panel, 0, WAIN / 2, 0.01, { parent: g, cast: false });
    const n = Math.max(1, Math.round(len / 0.55)), pw = len / n;
    for (let k = 0; k < n; k++) box(pw - 0.1, WAIN - 0.36, 0.018, M.panel, -len / 2 + pw * (k + 0.5), 0.2 + (WAIN - 0.36) / 2 + 0.03, 0.028, { parent: g, cast: false, tile: 0.4 });
    box(len, 0.05, 0.05, M.trim, 0, WAIN, 0.035, { parent: g });
    box(len, 0.16, 0.03, M.trim, 0, 0.08, 0.03, { parent: g });
  };
  const FD = R.z1 - R.z0, FW = R.x1 - R.x0;
  wains(FD, R.x1, (R.z0 + R.z1) / 2, -Math.PI / 2); wains(FD, R.x0, (R.z0 + R.z1) / 2, Math.PI / 2);
  wains(FW, 0, R.z1, Math.PI);
  wains(dl - R.x0, (R.x0 + dl) / 2, R.z0, 0); wains(R.x1 - dr, (R.x1 + dr) / 2, R.z0, 0);
  for (const [l, x, z, ry] of [[FD, R.x1 - 0.04, (R.z0 + R.z1) / 2, Math.PI / 2], [FD, R.x0 + 0.04, (R.z0 + R.z1) / 2, Math.PI / 2], [FW, 0, R.z0 + 0.04, 0], [FW, 0, R.z1 - 0.04, 0]]) box(l, 0.1, 0.08, M.trim, x, R.ceil - 0.05, z, { ry });

  const dw = doorway(root, add, box, R, M, dl, dr, true);

  const shadeMat = shadeMaterial();
  const lamp = floorLamp(root, add, R.lamp, shadeMat);

  // coat rack, far left corner
  const rack = new THREE.Group(); rack.position.set(-1.62, 0, 2.2); root.add(rack);
  const pole = add(new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.025, 1.8, 12), M.trim), true, true, rack); pole.position.y = 0.9;
  for (let k = 0; k < 3; k++) { const a = k * 2.1, l = add(new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.02, 0.4, 8), M.trim), true, true, rack); l.position.set(Math.cos(a) * 0.13, 0.15, Math.sin(a) * 0.13); l.rotation.set(Math.sin(a) * 0.6, 0, -Math.cos(a) * 0.6); }
  const coatProf = [[0, 0], [0.2, 0], [0.19, 0.3], [0.16, 0.7], [0.13, 0.95], [0.07, 1.05], [0, 1.08]].map(([r, y]) => new THREE.Vector2(r, y));
  const coat = add(new THREE.Mesh(new THREE.LatheGeometry(coatProf, 18), M.cloth), true, true, rack); coat.position.set(0.12, 0.66, 0.06); coat.scale.set(1, 1, 0.55); coat.rotation.y = -0.4;
  const hat = add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.1, 18), M.cloth), true, true, rack); hat.position.set(-0.05, 1.83, 0); hat.rotation.z = 0.3;

  // radiator on the right wall
  const rad = new THREE.Group(); rad.position.set(R.x1 - 0.12, 0.08, -2.55); root.add(rad);
  for (let k = 0; k < 13; k++) { const col = add(new THREE.Mesh(new THREE.CapsuleGeometry(0.028, 0.58, 4, 10), M.iron), true, true, rad); col.position.set(0, 0.36, (k - 6) * 0.065); col.scale.set(1.6, 1, 1); }
  box(0.08, 0.04, 0.88, M.iron, 0, 0.06, 0, { parent: rad }); box(0.08, 0.04, 0.88, M.iron, 0, 0.68, 0, { parent: rad });

  // console table with a small lamp, far end
  const table = new THREE.Group(); table.position.set(1.2, 0, R.z1 - 0.22); root.add(table);
  box(0.9, 0.035, 0.36, M.trim, 0, 0.78, 0, { parent: table });
  for (const [x, z] of [[-0.41, -0.15], [0.41, -0.15], [-0.41, 0.15], [0.41, 0.15]]) box(0.035, 0.78, 0.035, M.trim, x, 0.39, z, { parent: table });
  const tshade = add(new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.13, 0.17, 32, 1, true), shadeMat), false, false, table); tshade.position.set(-0.24, 1.12, 0);
  const tbase = add(new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.07, 0.26, 16), M.brass), true, true, table); tbase.position.set(-0.24, 0.93, 0);
  const tlamp = new THREE.PointLight(0xffc68c, 1.1, 0, 2); tlamp.position.set(1.2 - 0.24, 1.08, R.z1 - 0.22); root.add(tlamp);

  lighting(scene, renderer, R.lamp);
  return { root, lamp, lampShade: shadeMat, tlamp, door: dw.leaf, spill: dw.spill, back: dw.back, M, ROOM: R };
}

/** One plaster room, one doorway, one floor lamp. Returns { root, lamp, lampShade, door, spill, back, M, ROOM }. */
export function buildPlainRoom(scene, renderer) {
  const R = PLAIN, root = new THREE.Group(); scene.add(root);
  const { add, box } = helpers(root), M = baseMaterials();
  M.wall = new THREE.MeshStandardMaterial({ map: plaster(9), roughness: 0.92 });
  floorMesh(root, add, R, M);
  const { dl, dr } = walls(root, add, R, M.wall, 1.0);
  // skirting on all four walls
  const FD = R.z1 - R.z0, FW = R.x1 - R.x0;
  box(FD, 0.12, 0.025, M.trim, R.x1 - 0.012, 0.06, (R.z0 + R.z1) / 2, { ry: -Math.PI / 2, cast: false });
  box(FD, 0.12, 0.025, M.trim, R.x0 + 0.012, 0.06, (R.z0 + R.z1) / 2, { ry: Math.PI / 2, cast: false });
  box(FW, 0.12, 0.025, M.trim, 0, 0.06, R.z1 - 0.012, { cast: false });
  box(dl - R.x0, 0.12, 0.025, M.trim, (R.x0 + dl) / 2, 0.06, R.z0 + 0.012, { cast: false }); box(R.x1 - dr, 0.12, 0.025, M.trim, (R.x1 + dr) / 2, 0.06, R.z0 + 0.012, { cast: false });
  const dw = doorway(root, add, box, R, M, dl, dr, false);
  const shadeMat = shadeMaterial();
  const lamp = floorLamp(root, add, R.lamp, shadeMat);
  lighting(scene, renderer, R.lamp);
  return { root, lamp, lampShade: shadeMat, door: dw.leaf, spill: dw.spill, back: dw.back, M, ROOM: R };
}
