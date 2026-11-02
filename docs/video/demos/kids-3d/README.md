# Nour learns to share, in 3D (kids demo)

The same 31-second story as [`../kids/`](../kids), with the optional 3D look: [`kids-3d.mp4`](kids-3d.mp4). Both characters are built from primitives (spheres, capsules, rounded boxes, a rounded cone) with clay-like materials, lit by a sun and a sky light, and they cast soft shadows on a 3D meadow or room. The script, storyboard, voice and captions are the same files; the scene props only add `"look": "3d"`, and each character has a [`puppet3d.json`](characters/nour/puppet3d.json) next to its bible.

**Checked:** `video-qa` passes every check on the final render (the same kids' checks as the flat demo). Report and contact sheet are in [`qa/`](qa). Rendered with HyperFrames 0.8.226 and three.js 0.186.1 (vendored in `video-core`).

**Speed:** with a GPU (this Apple M4 Pro) the 31-second film renders in about 16 seconds, as fast as the flat one. In a test of a 3-second clip with software WebGL forced on, the render took about 6 times as long as with the GPU (18 s against 3 s), so 3D stays opt-in: the flat look is the default. A GPU render and a software render look the same to the eye (50 dB PSNR) but are not byte-identical.

**Not photorealistic.** This is a polished toy or clay look made in code, original to this library. Photorealism would need authored models, which this version does not load. The voices are the same pitch-shifted Kokoro voices as the flat demo (not real children).

Reproduce: as in the flat demo, then `node <video-kids>/scripts/puppet3d.mjs scaffold projects/kids --character nour` (and `pip`), add `"look": "3d"` to each puppet scene's props, and render. Pip's cap and button were added by hand to `puppet3d.json` after `scaffold`. The voice files (`voice/*.wav`) are not kept in git.
