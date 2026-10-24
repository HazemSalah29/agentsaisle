# Images and fonts

Read this when you add images, video or fonts.

## Images

- Use `next/image`, not a bare `<img>`, for content images. Give it `width` and `height` (or `fill` inside a sized, positioned parent) so no layout shift happens.
- Set `sizes` to the rendered width at each breakpoint, for example `sizes="(min-width: 768px) 50vw, 100vw"`. Without it the browser assumes full width and downloads too much.
- The largest above-the-fold image (usually the hero) gets `priority`, which preloads it and keeps it out of lazy loading. Everything else stays lazy.
- Prefer modern formats (AVIF or WebP, which `next/image` serves when the browser supports them). Do not ship a 4000 px photo for a 600 px slot: resize the source.
- Decorative images get `alt=""`. Meaningful images get a short, specific `alt`.
- For a background image that matters to the first paint, use `next/image` with `fill` and `object-fit` instead of a CSS background, so it is preloaded and sized.

## Video

- Add a `poster` image and `preload="none"` for video below the fold. Autoplaying video must be muted, `playsinline`, and short; give it a static fallback for reduced-motion users.
- Do not autoplay several videos at once.

## Fonts

- Load fonts with `next/font` (local or Google). It self-hosts the files and sets `size-adjust` fallbacks, which avoids a layout jump when the font loads.
- Limit to two families and only the weights you use. A variable font is usually smaller than three static weights.
- Subset to the scripts you need (`subsets: ["latin"]`).
- Use `display: "swap"` (the `next/font` default) unless you have measured a reason not to.
- Never load fonts with a `<link>` to a third-party stylesheet in a Next.js app.

## Below the fold

- Lazy-load anything not visible on first paint: images (default), iframes (`loading="lazy"`), heavy client components (`next/dynamic`).
- Do not lazy-load the LCP element.
