# What the numbers mean

| Field                                                                             | How it is measured                                                                                                                                                            | Trust it for                                                           |
| --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| `pace.cuts`, `cutsPerMinute`, `averageShotSeconds`                                | ffmpeg's scene detector on picture brightness (score 10 or more). A cut between two shots of the same brightness is missed; a fast camera move or a flash can count as a cut. | Rough pace. Treat as plus or minus a few cuts.                         |
| `pace.hookSeconds`                                                                | Time of the first cut, or the whole length if there is none.                                                                                                                  | A hint of how soon the first change comes.                             |
| `shares.moving`                                                                   | Share of 5-per-second samples where the picture changes between frames.                                                                                                       | Static against busy.                                                   |
| `shares.sound`                                                                    | Share of the time that is not silence (quieter than -35 dB for 0.35 s).                                                                                                       | Whether there is sound most of the time. It does not say it is speech. |
| `shares.speech`, `speech.wordsPerMinute`, `openingEndsAt`, `lastSentenceStartsAt` | Words and times from whisper.cpp when it is set up (trimmed to the sound, because whisper chains each word to the one before); `null` otherwise. No words are stored.         | Talking time and speed. Times only, never text.                        |
| `palette`                                                                         | Five dominant colours from about 12 frames (k-means, fixed start so it repeats).                                                                                              | The look. Not a brand: colours of the footage, including skin and sky. |
| `tempo`                                                                           | A guess from repeating sound onsets between 60 and 180 BPM, with a confidence. It may be half or double the felt tempo and means nothing for speech or ambient sound.         | Little. A heuristic; say so.                                           |

## Never measured

Text on screen, caption style, music genre or whether music is present, who is speaking, what is said. The recipe lists these under `notMeasured`; do not fill them in from a guess.

## Limits and rights

Only the first ten minutes are measured. The rights basis is what the user typed; it is recorded and not verified. The recipe has the reference's file name and SHA-256 so it can be traced; it has no path from the user's machine. A recipe is a description of pace and look. Matching it is fine; copying the reference's footage, audio, script or characters is not, and nothing in the recipe could do it.
