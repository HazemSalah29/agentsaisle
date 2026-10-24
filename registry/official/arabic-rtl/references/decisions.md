# Decisions asked once

Saved to `i18n.config.json` at the project root by `scripts/i18n-config.mjs --init`; every later run reads it. Ask only what the user has not already told you or what the file does not already answer (`--check` prints the file and says which keys fell back to defaults). Offer the default and move on if the user has no preference.

| Key             | Question                       | Options                                                                   | Default                |
| --------------- | ------------------------------ | ------------------------------------------------------------------------- | ---------------------- |
| `locales`       | Which languages?               | language tags, must include `ar`                                          | `["en", "ar"]`         |
| `defaultLocale` | Which is the default?          | any listed                                                                | `en`                   |
| `urlStrategy`   | How do URLs show the language? | `prefix` (`/ar/...`), `domain`, `cookie`                                  | `prefix`               |
| `arabicVariety` | Which Arabic?                  | `msa`, `egyptian`, `gulf`, `levantine` (dialects only for marketing copy) | `msa`                  |
| `digits`        | Which digits?                  | `latn` (0-9), `arab` (٠-٩)                                                | `latn`                 |
| `calendar`      | Which calendar?                | `gregorian`, `gregorian+hijri`                                            | `gregorian`            |
| `addressing`    | How to address the user?       | `neutral`, `masculine`, `variants`                                        | `neutral`              |
| `arabicFont`    | Which Arabic font?             | the list in `typography.md`                                               | `IBM Plex Sans Arabic` |

Command:

```bash
node <skill>/scripts/i18n-config.mjs --init --locales en,ar --default-locale en --digits latn
```

Flags: `--locales`, `--default-locale`, `--url-strategy`, `--arabic-variety`, `--digits`, `--calendar`, `--addressing`, `--arabic-font`. It refuses to overwrite an existing file without `--force`.

How each answer is used:

- `urlStrategy` -> `localePrefix` / `domains` / `localeDetection` in `routing.ts` (`i18n-nextjs.md`). `prefix` maps to `localePrefix: "always"`.
- `digits`, `calendar` -> the locale tag helper in `numbers-dates.md` (`-u-nu-latn` or `-u-nu-arab`, optional `-u-ca-islamic-umalqura`).
- `arabicVariety`, `addressing` -> `translation.md`.
- `arabicFont` -> `assets/fonts.ts` and `typography.md`.
