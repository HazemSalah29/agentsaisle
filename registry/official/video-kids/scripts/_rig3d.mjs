// The 3D puppet rig: a character built from a few primitives (spheres, capsules, rounded boxes, droplets,
// cylinders) with materials, as plain data (puppet3d.json). The page code in puppet3d-page.mjs turns that data
// into three.js objects; nothing in the data is ever run, and no model files or textures are loaded.
// This module only checks the data. It touches no disk, network or page.

// The parts every character needs: the same list as rig.mjs (a test keeps them in step), so this file stands alone.
const REQUIRED = [
  "body",
  "head",
  "arm-l",
  "arm-r",
  "leg-l",
  "leg-r",
  "eyes-open",
  "eyes-closed",
  ...["rest", "a", "e", "o", "u", "mbp", "fv", "l"].map((v) => `mouth-${v}`),
];

export const SHAPES = ["sphere", "capsule", "box", "droplet", "cylinder"];
export const LIMITS3D = { parts: 60, materials: 16, extent: 10, rotation: 360 };
const ID = /^[a-z][a-z0-9-]{0,23}$/;
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const MAT_KEYS = ["roughness", "metalness", "clearcoat", "sheen", "opacity"];
const num = (v, lo, hi) => typeof v === "number" && Number.isFinite(v) && v >= lo && v <= hi;
const vec = (v, n, lo, hi) => Array.isArray(v) && v.length === n && v.every((x) => num(x, lo, hi));

/** Problems with a 3D rig, as readable strings. An empty list means the renderer can use it. */
export function rig3dProblems(rig) {
  if (!rig || typeof rig !== "object" || Array.isArray(rig))
    return ["the 3D rig must be an object"];
  const out = [];
  if (!ID.test(rig.name ?? "")) out.push("name: lower-case letters, digits and hyphens");
  if (!num(rig.height, 0.5, LIMITS3D.extent))
    out.push("height: the character's height in world units, 0.5 to 10");
  const mats = rig.materials;
  if (!mats || typeof mats !== "object" || Array.isArray(mats))
    out.push("materials: must be an object");
  else {
    const names = Object.keys(mats);
    if (!names.length || names.length > LIMITS3D.materials)
      out.push(`materials: 1 to ${LIMITS3D.materials}`);
    for (const n of names.slice(0, LIMITS3D.materials)) {
      const m = mats[n];
      if (!ID.test(n)) out.push(`materials.${n}: name is lower-case letters, digits and hyphens`);
      if (!m || !HEX.test(m.color ?? "")) out.push(`materials.${n}.color: #hex`);
      if (m?.emissive !== undefined && !HEX.test(m.emissive))
        out.push(`materials.${n}.emissive: #hex`);
      for (const k of MAT_KEYS)
        if (m?.[k] !== undefined && !num(m[k], 0, 1)) out.push(`materials.${n}.${k}: 0 to 1`);
    }
  }
  if (!Array.isArray(rig.parts)) return [...out, "parts: must be a list"];
  if (rig.parts.length > LIMITS3D.parts) out.push(`parts: at most ${LIMITS3D.parts}`);
  const ids = new Set();
  for (const [i, p] of rig.parts.slice(0, LIMITS3D.parts).entries()) {
    const at = `parts[${i}]`;
    if (!p || typeof p !== "object") {
      out.push(`${at}: must be an object`);
      continue;
    }
    if (!ID.test(p.id ?? "")) out.push(`${at}.id: lower-case letters, digits and hyphens`);
    else if (ids.has(p.id)) out.push(`${at}.id: "${p.id}" is used twice`);
    else ids.add(p.id);
    if (!vec(p.pivot, 3, -LIMITS3D.extent, LIMITS3D.extent))
      out.push(`${at}.pivot: [x, y, z] in world units`);
    if (p.shape !== undefined && p.shape !== "none") {
      if (!SHAPES.includes(p.shape)) out.push(`${at}.shape: one of ${SHAPES.join(", ")}`);
      if (!vec(p.size, 3, 0.001, LIMITS3D.extent))
        out.push(`${at}.size: three numbers, 0.001 to 10`);
      if (!(mats && Object.hasOwn(mats, p.material)))
        out.push(`${at}.material: "${p.material}" is not in materials`);
    }
    if (p.position !== undefined && !vec(p.position, 3, -LIMITS3D.extent, LIMITS3D.extent))
      out.push(`${at}.position: [x, y, z] offset of the shape from its pivot`);
    if (p.rotation !== undefined && !vec(p.rotation, 3, -LIMITS3D.rotation, LIMITS3D.rotation))
      out.push(`${at}.rotation: [x, y, z] degrees`);
    if (p.radius !== undefined && !num(p.radius, 0, 5))
      out.push(`${at}.radius: 0 to 5 (corner roundness of a box)`);
  }
  for (const id of REQUIRED) if (!ids.has(id)) out.push(`parts: "${id}" is missing`);
  const parentOf = new Map(rig.parts.map((p) => [p?.id, p?.parent ?? null]));
  for (const [id, parent] of parentOf) {
    if (parent !== null && !ids.has(parent))
      out.push(`part "${id}": parent "${parent}" is not a part`);
    const seen = new Set([id]);
    for (let q = parent; q; q = parentOf.get(q) ?? null) {
      if (seen.has(q)) {
        out.push(`part "${id}": parents form a loop`);
        break;
      }
      seen.add(q);
    }
  }
  return [...new Set(out)];
}
