# AisleVideos studio

House rules for every video made in this folder. Edit the defaults below; the video skills read them.

## Defaults

- Format: reel-9x16 (also short-9x16, youtube-16x9, square-1x1)
- Length: 30 to 45 seconds
- Language: en
- Voice: kokoro, `am_michael` (a male narrator) or `af_heart` (a female narrator), speed 1.1. Your own recording beats any synthetic voice: drop it in `inbox/`.
- Look: preset `volt` (also ember, ice, grape), or your colours in `brand/brand.json`
- Captions: pop (also karaoke, clean, none)
- Music: an original generated bed, or your own licensed track from `library/music/`

## Rules

- One folder per video in `projects/<slug>/`: `video.json` is the source of truth; edit it and re-render.
- Every asset in `video.json` needs a licence. Music you add goes in `library/music/` with a `licence.txt`.
- Never put API keys in this folder.
- Nothing is uploaded automatically. Final files go to `exports/<slug>/`.
- Use only original characters, music and logos, or ones you hold a licence for.
