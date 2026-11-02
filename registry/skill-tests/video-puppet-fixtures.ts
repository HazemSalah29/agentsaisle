export const SHAPE = '<circle cx="10" cy="10" r="5" fill="#336699"/>';
type Loose = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any

/** A minimal valid rig: every required part is one small circle. */
export const sampleRig = (over: Loose = {}): Loose => ({
  name: "test-critter",
  box: { w: 300, h: 400 },
  palette: ["#336699", "#ffcc00", "#ffffff"],
  parts: [
    "body",
    "head",
    "arm-l",
    "arm-r",
    "leg-l",
    "leg-r",
    "eyes-open",
    "eyes-closed",
    "mouth-rest",
    "mouth-a",
    "mouth-e",
    "mouth-o",
    "mouth-u",
    "mouth-mbp",
    "mouth-fv",
    "mouth-l",
  ].map((id) => ({
    id,
    parent:
      id === "body" ? null : id.startsWith("mouth") || id.startsWith("eyes") ? "head" : "body",
    pivot: [150, 200],
    svg: SHAPE,
  })),
  ...over,
});

/** A complete, original character bible. */
export const GOOD = `# Nour the turtle

- Name: Nour
- Species: turtle
- Shape language: round
- Palette: #3f9f6b, #f2c94c, #ffffff, #3a2a4d
- Outfits: a small red scarf in cold weather
- Catchphrase: "Slow and steady, side by side!"
- Personality: Gentle, curious and a little shy.

## Never

- Never shouts at or teases anyone.
- Never looks like Bluey or any other known character.
`;
