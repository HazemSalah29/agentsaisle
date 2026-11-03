# AisleVideos studio

House rules for every video made in this folder. Edit the defaults below; the video skills read them.

## Defaults

- Format: reel-9x16 (also short-9x16, youtube-16x9, square-1x1)
- Language: en (Arabic: ar, with dir rtl)
- Voice: kokoro (local). Set to `none` for silent videos.
- Engine: hyperframes
- Budget: $0 (local tools only). Paid generation always asks first and logs to `projects/<slug>/spend.json`.

## Rules

- One folder per video in `projects/<slug>/`: `video.json` is the source of truth; edit it and re-render.
- Every asset in `video.json` needs a licence. Music and sound effects go in `library/` with a `licence.txt`.
- Never put API keys in this folder. Keys come from operating-system environment variables only.
- Nothing is uploaded automatically. Final files go to `exports/<slug>/`.
- Use only original characters, music and logos, or ones you hold a licence for.
