# Mirroring for right-to-left

What `apply` does when the direction changes (English to Arabic, or back):

- Sets `meta.lang` and `meta.dir`; the renderer then uses logical CSS, so titles, quotes, lists and captions flip by themselves.
- Puppet scenes: each character's `x` becomes `1 - x`, `flip` toggles, and `walk` targets are mirrored. Run `visemes.mjs` again after re-voicing.
- Charts, code, sequence, request-flow and rate-limit scenes are drawn left to right in both languages on purpose (numbers and code do not mirror).
- Not mirrored: screen recordings (the interface is baked into the video; `zoom` and `cursor` points stay tied to it), and wording inside diagram sources.
- Captions use the target language's words and punctuation; they are rebuilt by `captions.mjs`. Check that `brand/fonts` has an Arabic font.
