# The Security and AI views

Both read facts already in the model (see `model-schema.md`); neither guesses. A fact the model does not record shows as "not recorded" or with a question mark.

## Security

- **Zones**: each component with a `zone` (`public`, `dmz`, `private`, `third-party`, `user-device`) gets an outline in the zone's colour and the zone's name under it. The diagram never moves, so a zone is drawn around each component, not as one big box.
- **Crossings**: a connection between two components in different zones is drawn thick in the view's colour.
- **Authentication and encryption**: connection labels show `auth` and `tls` (for example "jwt · TLS"). "auth ?" or "TLS ?" means the model records `unknown`.
- **Data**: components with `data` labels have a coloured outline; connections whose `carries` is set are coloured. Labels are kinds of data (`pii`, `credentials`, `payments`, `health`, `secrets-ref`, `logs`), never values.
- **Where does personal data go?**: highlights every component holding `pii` and every connection carrying it, and lists them. It also counts connections out of those components that record nothing about their data, because the model does not say whether personal data travels along them.

The rules that use these facts are AV-R13 (a zone crossing with no authentication or encryption) and AV-R14 (personal data reaching a third party or logs). Record a fact only when a file shows it, with that file as evidence, or write `"unknown"`.

## AI

- Components with an `ai` entry (`llm-provider`, `agent`, `mcp-server`, `skill`, `vector-store`) are highlighted with a badge in the top-left corner: the **audit grade** letter if an `aisle audit` result is linked, a dash if not.
- A grade is only accepted when `ai.auditSource` points at a real audit file in the project and the grade matches it (`model-check.mjs --root`).
- The panel shows the kind, the grade, the audit file and the tools (`ai.tools`, taken from the skill's frontmatter or the agent's configuration, with that file as the component's evidence).
- AV-R15 flags an agent, MCP server or skill with write or run tools and no grade; AV-R16 flags a grade of D or F. An audit reduces risk; it cannot prove safety.
