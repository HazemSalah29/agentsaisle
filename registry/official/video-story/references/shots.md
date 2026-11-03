# shots.json

```json
{
  "generator": "stills-only",
  "aspect": "9:16",
  "shots": [
    {
      "id": "s1",
      "lines": ["l1", "l2"],
      "seconds": 5,
      "camera": "slow push-in, eye level",
      "action": "Mina finds a lantern on the beach",
      "mood": "quiet, golden hour",
      "characters": ["mina"],
      "prompt": "Mina, a girl with a yellow raincoat, kneels on a pebble beach holding a paper lantern, painted storybook style",
      "motion": "the lantern glows brighter",
      "asset": "s1-still"
    }
  ]
}
```

- `lines`: the script lines this shot covers; every script line is used once, in order.
- `seconds`: 3 to 8. `motion` is required for clip generators and describes only the movement; the keyframe prompt describes the picture.
- `characters` must be described in `style-bible.md`.
- `asset`: the `video.json` asset id of the shot's still or clip (set it after generating).
- Prompts name no known character, brand or real person.

# continuity.json

Per shot: `location`, `timeOfDay`, `anchor` (a project-relative image: the best earlier frame, or a reference-pack view), and per character `outfit` and `props`. Any change from the previous shot needs a `change` reason.
