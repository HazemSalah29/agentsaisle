// Ember room kit: glowing faceless figures in a dim 3D room. Import map needed: { "three": "<path>/vendor/three/three.module.js" }.
export { makeEngine, W, H, FPS } from './engine.js';
export { Figure, EMBER, GOLD, MOON, BN, V, local, ldir, stand, walk, pathAt, pathLen, travel } from './figure.js';
export { buildHall, buildPlainRoom, HALL, PLAIN } from './room.js';
export { rng, noise2, floorPlanks, walnut, wallpaper, rug, plaster, glow } from './tex.js';
