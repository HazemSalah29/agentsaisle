# Rights and install

## Rights bases

| Basis           | Meaning                                                                      | Note needed                   |
| --------------- | ---------------------------------------------------------------------------- | ----------------------------- |
| `own`           | The user made it or owns the channel it is on.                               | No                            |
| `permission`    | The owner agreed in writing (message, email, contract).                      | Who and where, 15+ characters |
| `cc`            | A Creative Commons licence that allows the use. Attribution goes in credits. | Licence name and link         |
| `public-domain` | No copyright applies (age, government work, CC0).                            | Why, with a link              |

The ledger records the user's statement; this skill cannot check it. Fair use and similar exceptions are legal opinions: do not claim them, and do not record `own` for someone else's work.

## Refused

No basis, "none", http URLs, URLs with a user name or password, local or numeric addresses, custom ports, and the hosts in `assets/blocked-hosts.json` (paid, DRM or login-only services). `TODO(verify)`: the host list is a working default.

## Install yt-dlp (the user does this)

The skill never installs programs. Options: `brew install yt-dlp`, `pipx install yt-dlp`, or the release page of the yt-dlp project. Run `/video doctor` to confirm. Every call is started with `--ignore-config --no-exec --no-playlist`, a 500 MB cap, and the URL last after `--`. `TODO(verify)`: flag names against current yt-dlp docs.

## Ledger file

`rights-ledger.json`: `entries[]` with `id`, `rights`, `note`, `source`, `file`, `bytes`, `sha256`, `tool`, `date`, `analysisOnly`. Keep it with the project; `--verify` reports missing or changed files.
