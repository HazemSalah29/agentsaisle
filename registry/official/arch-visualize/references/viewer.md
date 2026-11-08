# The page (`docs/architecture.html`)

One self-contained file. It makes no network requests (no CDN, fonts, icons or analytics), so it works offline from `file://`. The model and icons are embedded as data. Labels, notes and file paths are shown as text, never as HTML. See `visual-design.md` for how it looks and `layout.md` for how the diagram is laid out.

## Reading the diagram

- Columns run left to right by tier: Clients, Edge, Frontend, Backend, Async, Data, External. Empty tiers disappear. Groups from the model are drawn as labelled boxes around their components.
- Each box has the technology icon, the label and the technology. A small number in the corner is the count of possible risks that name that component.
- A solid outline or line is backed by files. **Dashed** means inferred: the model says it exists but no file shows it.
- Select a component or a connection to see its role, technology, evidence (`file:line`), connections and risks in the side panel. Selecting moves keyboard focus to the panel; **Esc** closes it and puts focus back.
- How much is drawn depends on the zoom: zoomed far out you see bands, group boxes and icons; closer, the labels; closer still, the technology line, risk badges and the protocol written on each connection.

## Views (lenses)

A switcher above the diagram changes what the page emphasises, never where things are.

- **System**: the default. The parts and how they connect.
- **Security**, **Failure** and **AI**: appear when the model has something for them (zones, authentication or data labels; at least one connection; an AI component). See `security-lens.md` and `simulation.md`. A risk card shows its options with their trade-offs, and a button that opens the Failure view for the component it names.
- **Flows**: appears when the model has flows. Pick a flow from the tabs. **Focus** (on by default) fades everything outside the flow. **Play** runs it, **Step** moves one step, **Back** goes one step back, **Restart** resets, the slider scrubs to any step, and the speed menu offers 0.5x, 1x and 2x. A filled dot is a request; a hollow ring is a response travelling back. A step marked `together` in the model shows several dots at once. Events flash their component. The **Flow** tab lists the steps. Under reduced motion nothing moves by itself, Step jumps instantly, and Play is labelled "Play (uses motion)".

## Finding things

- Press `/` to search labels, technology, file paths, protocols and risk ids. Matches are highlighted, the rest fades, and the view centres on the first match. Arrow keys move through the results, Enter selects, Esc clears.
- **Trace path**: click a start component, then an end component. The panel lists every path that follows the direction of the connections, shortest first, with the hop count and the asynchronous segments marked (dotted on the diagram). Pick one to highlight it.
- The minimap in the corner shows the whole diagram and the part in view; click or drag it, or focus it and use the arrow keys.
- **Changes** (the Diff view): appears only when the page was built with `render.mjs --diff <file>`. Added components and connections are green with a "+", changed ones amber with a "~" and, for components, a dashed outline, and renamed ones amber with the old and new id in the list. Things that are no longer in the model are drawn as dashed ghosts with a "−" where they used to be; they are only in this view, so search, the lists, the risks and the what-if simulation never include them. Everything unchanged is dimmed. The panel lists what was added, changed, renamed and removed, and the new and resolved risks; selecting a changed component shows each changed fact as before and after. The marks use a symbol as well as a colour; connections that were added or changed are marked by colour and line style only, and are listed in the panel by name. Printing puts the list of changes before the risks. How the diff is made: `diff.mjs`, below.
- The address keeps the view: `#lens=flows&flow=login&step=2&node=redis&x=40&y=30&k=0.8`. Open the file with that address to land on the same view. The address only changes after you do something, and pages that cannot change it (some embedded frames) simply do not.

## Saving

**Export** saves the diagram as SVG or PNG, the model as JSON, or prints it (see `export.md`).

## Other controls

- Drag to pan, scroll or +/- to zoom, Fit to reset. With the diagram focused: arrow keys pan, `+` and `-` zoom, `0` fits.
- Components are keyboard focusable; Enter or Space selects.
- Light and dark follow the system; the button switches.
- On a narrow screen the diagram becomes a list of components.
- **Language and direction**: `render.mjs --lang ar` writes the Arabic interface (right to left; the panel and toolbar mirror). `--flow-dir rtl` also runs the diagram right to left. Text that comes from the project (labels, flow names, risk wording) stays as written. The Arabic interface text is a draft that needs a native speaker's review.

## Risks

The **Risks** tab lists every risk, each labelled "possible risk to check". Rule-based ones say they are heuristics when they are. They are prompts to look, not findings of fault, and the page never claims an architecture is best or correct.

The header says "Generated from code; not live traffic." The page shows how requests would travel according to the files read.

## Comparing two models

`node scripts/diff.mjs --base docs/architecture.base.json --head docs/architecture.json --out docs/architecture.diff.json` compares two models (version 1 or 2) and writes a diff file. Components are matched by id first; a component that is gone is matched to a new one only when both have the same technology, share at least one evidence file, and nothing else could match either of them (otherwise they stay "added" and "removed": the script does not guess). Connections are matched by id, then by their two ends (after renames) and protocol. These facts are compared: for components `label`, `tech`, `role`, `zone`, `replicas`, `owner`, `ai`, `data`; for connections `protocol`, `sync`, `auth`, `tls`, `timeoutMs`, `retries`, `optional`, `carries`. Lists are compared as sets. A moved evidence line is not a change. The output is sorted, so the same two models give the same file. A change is not a failure: the exit code is 0 when the comparison ran and 2 when it could not (a missing flag, a file that cannot be read, an invalid model, or an output file that is not a diff and no `--force`).

Then `node scripts/render.mjs --model docs/architecture.json --diff docs/architecture.diff.json` opens on the Changes view (`--lens` picks another start). A diff file that is not exactly what `diff.mjs` writes is refused.

Limits: a rename is only recognised by the rule above, so a component renamed and moved to another file shows as one removed and one added. A removed component is placed by the same layout as the rest, so the diagram of a page built with a diff can differ slightly from the plain page. See `ci.md` for running this in a pull request.

## The inside view (0.3.0)

When a node has `detail`, the page shows a count on it and opens it on double-click, `Z` or the panel's **Zoom in**: a smooth camera move into the component, then a list (filter by name, file or description; tabs for components, functions, routes, hooks), the inner diagram, and a trace table of the selected function's calls with Step, Play and Back. Keys: `[` `]` step, `P` plays, `L` hides the list, `Esc` goes back one level. `#in=<node>&sym=<file>#<name>` in the address opens a view directly. Under reduced motion the zoom happens in one step and nothing plays until asked. On a phone the diagram is hidden, so the panel's grouped list is the way in. See `inside.md`.
