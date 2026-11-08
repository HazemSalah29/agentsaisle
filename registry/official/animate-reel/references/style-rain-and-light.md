# Style: Rain, ripples and light

**Production readiness:** needs work (the pool is a small ellipse on a large dark frame; rings overlap into a tangle at the peak; type is thin and small; no camera; scenes beyond two pools are unproven)

Dark pools of water seen from slightly above, each drop making rings that spread and fade, with a soft band of window light sliding over the surface. Craft source: the ripple and raindrop shaders on godotshaders (descended from a Shadertoy raindrop shader, CC BY-NC-SA, so the technique is rewritten here, never copied). Quiet and tactile; suits mercy, patience and time passing.

## Look

- Near-black blue ground (#04070c). Water is an ellipse (a circle squashed to 0.36 height) with a teal radial gradient and a thin grey rim.
- Rings are pale blue hairlines with a faint warm echo line under the first ring. A bright small splash ellipse at the moment of impact.
- Window light: a wide soft amber band that crosses the water slowly. Text is a light sans (Avenir Next 300), a warm gold line for the key phrase, small spaced capitals for pool labels.

## Motion

- Weight: water is light, so there is no spring on the rings. Every ring grows linearly with age and fades by `(1 - age/3)^2`. A drop's splash is a short bright pop (2 to 3 frames), not a bounce.
- Camera: an overhead view with a slow drift. It pushes down toward a pool, or slides across to the next one, always at under 6 percent. It never tilts, never spins, never uses a depth blur; reflections and light bands give the depth.
- Entering: things arrive as a drop on the surface, with three rings spreading 0.22 s apart, or as a light band crossing in. Leaving: rings fade to flat water; the light band moves on and leaves a still pool.
- Transformations: a downpour to still water; a single drop to a widening field of rings; warm window light sliding into cold dark water.
- Transitions: 1) a band of window light crosses the frame at constant speed (about 108 px a second) and the next pool is under it, 2) the rain thins and stops while one drop keeps falling, so the scene changes by its rhythm, 3) one set of rings keeps spreading until it fills the frame and becomes the next pool's surface.
- Timing feel: slow, quiet, rhythmic. A drop every 0.72 s is the heartbeat, the downpour lasts about 1 s, and holds are 1 s or more.
- Never moves: the rim of each pool and the ground. The light band never speeds up or reverses, and rings never grow faster than linear.

## How it explains

- Story device: Two pools stacked on screen: one heavy downpour that leaves still water, one drop at a time that keeps it moving.
- Arrows and flow: Concentric rings spreading outward from the point of impact.
- Labels and text: A light sans caption with a warm gold line for the key phrase; small spaced capitals label each pool.
- Numbers and counts: One drop at the same spot every 0.72 s, so the count is felt as a rhythm.
- Emphasis: A bright splash at impact and the warm light band crossing the water.
- Scene change: No cut; one slow band of window light carries the viewer from pool to pool.

## Build notes

- Statelessness: a drop is {t0, x, y}; its ring at time t depends only on t - t0. Drop times and places come from a sine hash `H(n)`, so frame(t) is pure.
- Canvas 2D only. Clip to the pool ellipse, use `lighter` compositing for the light band. Render took about 2.4 minutes for 300 frames, no frame was slow.
- Draw rings only while age is under 3.2 s, or the per-frame cost grows with the drop list.
- Sound: `drop` on each drip, `tick` on a quarter of the downpour drops so it does not turn to noise, one `bong` at the start of each half.
- A third idea (a water level or a worn mark in stone) fit the brief but was left out; the upper-versus-lower pool comparison already carries the point.

## Good for (examples, never limits)

Rain and mercy, small steady deeds, patience, hardship passing (the downpour stops).

## References

- godotshaders.com raindrops and ripple-shader pages (unverified): ring radius as age times speed, fade over two seconds.
- Shadertoy ldfyzl raindrops (unverified, CC BY-NC-SA, read for the idea only).
- thebookofshaders.com, chapter on noise and hashing (unverified): the stateless hash idea.

## Working example

`assets/styles/rain-and-light.html`: a 10 s page in this style (the hook of reel A, Bukhari 6464). Read it for the techniques; do not reuse its layout as a template.
