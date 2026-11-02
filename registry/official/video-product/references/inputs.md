# Inputs and rights

## Photos

- 2 to 6 photos of the product, PNG, JPEG or WebP, up to 25 MB each. Three different angles beat six near-duplicates.
- Best: the product on a plain, fairly even background, centred, not cropped, in focus, at least 1500 px on the long side. The cutout uses OpenCV GrabCut (works on any computer) and is weak on busy scenes, glass, fur and thin parts. It tells you when it is not sure; use a plain background or give a cutout PNG with transparency (`cutout.mjs --alpha`).
- Keep the product away from the edges: the camera pushes in and shakes, which crops the frame by up to 20%.
- A person in a photo needs the person's permission to appear in an ad. Ask; do not guess.

## Words

- Product name up to 30 characters, up to 3 lines of up to 36, a call to action up to 24, a price up to 12 characters. They are shown exactly as the user wrote them. Never add a claim ("best", "#1", a percentage, a date) the user did not give.

## Music and sound

- Music is optional and must be the user's own or licensed for this use; its licence text (up to 80 characters) goes in the credits. The edit never downloads music. Without music the sound is the original effects only.
- The sound effects are made by `sfx.mjs` from maths: original, no licence needed.

## What is never used

- Another creator's edit, footage, photos, text, audio or name. A reference edit may be analysed for numbers only (`video-analyze`, with the right to analyse it).
- Generated people or characters, real people's likeness, or a known brand's logo unless the user owns it.
