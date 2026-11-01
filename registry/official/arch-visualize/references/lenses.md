# The views on the page

The page opens on **System**. The other views appear only when the model has something to show for them. Open one with the tabs, or with a link such as `docs/architecture.html#lens=security`. `render.mjs --lens <name>` picks the one it opens on.

| View     | Appears when                                                                          | What it shows                                                                                                                     | Read more            |
| -------- | ------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | -------------------- |
| System   | always                                                                                | the components by tier, grouped, with connections, search, path trace and the minimap                                             | `viewer.md`          |
| Flows    | the model has `flows`                                                                 | request flows you can play, step and scrub; steps marked `together` run side by side                                              | `flows.md`           |
| Security | some component has a `zone` or `data`, or a connection has `auth`, `tls` or `carries` | zones, connections that cross a zone, authentication and encryption on each connection, and where a kind of personal data travels | `security-lens.md`   |
| Failure  | the model has connections                                                             | pick a component to take down: what fails, what only gets delayed, which flows break. A what-if from the model, not a prediction  | `simulation.md`      |
| AI       | some component has an `ai` field                                                      | model providers, vector stores, tools, MCP servers and skills, with the audit grade if one is linked                              | `model-schema.md`    |
| Changes  | the page was built with `render.mjs --diff`                                           | what was added, changed, renamed and removed since an earlier model                                                               | `viewer.md`, `ci.md` |

Every fact in Security, Failure and AI comes from the model, and the model gets it from a file. If a view looks empty, the model is missing the facts, not the page. Add them only when a file shows them.

The Arabic page (`--lang ar`) is a machine draft: the text has not been read by a native speaker. Model text (labels, flow names, risk notes) stays as the project wrote it.
