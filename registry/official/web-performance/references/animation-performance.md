# Animation performance

Read this when you add or change motion.

## What is cheap and what is not

- **Cheap, runs on the GPU compositor:** `transform` (translate, scale, rotate) and `opacity`.
- **Expensive, forces layout:** `width`, `height`, `top`, `left`, `margin`, `padding`, `font-size`. These move other elements and shift the layout.
- **Expensive, forces repaint:** `box-shadow`, `filter`, `background-position`, large `border-radius` changes, animating gradients.
- To move something, use `transform: translate3d(...)`, not `left`. To grow something, use `transform: scale(...)`. To reveal something, animate `opacity` and `clip-path` (clip-path repaints, so keep the area small) or a mask element.

## Rules

1. Animate only `transform` and `opacity` for anything that runs on scroll, pointer move or in a loop.
2. Never animate layout properties. If a design needs a height reveal, animate a wrapper's `grid-template-rows` from `0fr` to `1fr`, or use the Web Animations API on a measured value once, not per frame.
3. Reserve space before content animates in. Elements that start hidden must still take their final size, or the page shifts (CLS).
4. Use `will-change: transform` only on an element that is about to animate and remove it afterwards. Do not put it on many elements at once; each one costs memory.
5. Scroll-linked effects use `IntersectionObserver` or a scroll-timeline, not a `scroll` listener that reads layout (`offsetTop`, `getBoundingClientRect`) on every event. If you must listen, read once, write once, and use `requestAnimationFrame`.
6. Pause what is not visible: stop looping animations and videos off screen and on hidden tabs.
7. Respect `prefers-reduced-motion: reduce`: replace movement with an instant change or a short fade, and stop autoplaying loops.
8. Keep durations short for interface feedback (100 to 250 ms) and reserve long durations for one hero moment per page.

## Checking your work

- Open the browser's performance panel, record a scroll or interaction, and look for long frames (over about 16 ms) and layout or paint work inside animations.
- Search the diff for `transition: all`, `animation` on `width` or `height`, and `top:` or `left:` inside keyframes. Replace each.
