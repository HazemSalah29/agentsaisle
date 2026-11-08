# Style: Nouveau card

An aged art-nouveau card lying on crushed burgundy velvet. It is dealt face down, turns over, and the picture on it comes alive: a hanging lamp lights inside an arched window. The words sit on a navy plaque with a gold border under the card. Bold even outlines, flat muted lithograph colours, gold foil edges, a halo-like arch.

**This card is never used as tarot or fortune-telling imagery.** Keep only the medium (the card as a printed object). No trump names, no roman numerals, no figure, no zodiac, no sun, moon or star divination symbols, no wheel, no hand-of-fate. The card frames a verse or an object (here a lamp; a flower or a crescent also works). The name panel carries a plain topic word ("REMEMBRANCE"), never a card title.

## Look

- Velvet ground: dark `#12050e`, mid `#4a122c`, high `#9a4262`, ridged folds from a warped sine field plus fbm mottle, built once at 270x480 and stretched 4x, then colour grain baked in.
- Card: paper `#eadcbc`, outline ink `#2a1c15`, teal band `#4f6a63`, gold foil gradient (`#7a5a22 #c9a54e #f3e3a0 #c39a44 #8d6a2a`), 450x775 at the centre, rounded 16 px.
- Window: stepped dusk sky (`#2c3350 #353a58 #41405f #514765 #62506a`), 36 alternating sunburst wedges (`#7d6a55`, `#a78a52`, alpha .55) turning very slowly, a soft dark glow at the heart, scattered gold dots (round, never stars).
- Lamp: gold body with teal and oxblood bands, a pointed-arch glass window, three bridle chains with dashed links, two handle rings, a flat teardrop flame. Vine with five-petal flowers along the foot of the window.
- Plaque: navy `#1d2744`, double gold border, soft shadow. Words in cream `#f4ead2` (Baskerville), Arabic in gold gradient.

## Motion

- 0.4 to 1.2 s: the card slides up from below, slightly rotated, face down (dark navy back, lozenge lattice, a round rosette). The plaque rises under it.
- 1.8 to 2.5 s: it flips (cos scale on x), with a lift and a deeper shadow mid-turn.
- 2.6 to 3.5 s: the lamp lights (glass warms from navy to amber, flame grows, the window floods warm, a halo opens behind the card), and a foil glint slides across the card.
- The lamp sways a little and the flame flickers for the whole reel. Gold dust drifts on the velvet.
- Words: the hook first, the Arabic written with the pen, then the English lines.

## How it explains

- Story device: Told as a framed card: the idea is the picture inside an ornamental border, and each card is one beat.
- Arrows and flow: Flowing whiplash vines or a gilded curved line linking motifs, ending in a leaf or bud.
- Labels and text: Text sits on a ribbon or cartouche with a decorative title, Arabic on the central plate.
- Numbers and counts: A small gold plaque or a row of gilt medallions that fill in one by one.
- Emphasis: A gold burst of light behind the key motif, or its colour shifting to the accent.
- Scene change: The card turns over or slides away to the next card; the frame stays as the constant.

## Build notes

- Build the face on its own layer (`CARD`, 490x815) and draw that layer into the flip transform. The shadow is drawn under it with `ctx.filter = blur()`.
- The age layers (scuffs, foxing rings, worn edge dots, print tooth) are built once at 400x690 and stretched over the face. Multiply a yellowing radial gradient over the face, then lay the tooth on with `overlay` and the glint with `lighter`.
- Card back: replace the reference's 4 and 8-point star lattice and its star medallion with lozenges and a round-petal rosette. The corner medallions and the cartouche hold flowers only.
- Gotcha: an almond oval with a vertical flame inside reads as an eye. Use a pointed arch for the lamp glass and a wide teardrop flame.
- Gotcha (font, checked 2026-10-24): Scheherazade New dots are small (about 11 px at 100 px type), and they can look missing in a shrunk still. Check them with a pixel blob count on a full-size crop, not by eye. Chrome 154 draws every dot.

## Good for (examples, never limits)

Remembrance, hearts at rest, a verse about light or a lamp, anything that is "revealed" or "turned over". Never let the card read as fortune-telling (never write "your card", "fate", "destiny").

## References

- `references/prompt-tarot-card.md` (a tarot card prompt; only the visual medium is kept)

## Working example

`assets/styles/nouveau-card.html`: a 10 s page (QURAN 13:28, "Where does a restless heart finally rest?"). Canvas 2D, about 1 to 3 ms per frame call, deterministic.
