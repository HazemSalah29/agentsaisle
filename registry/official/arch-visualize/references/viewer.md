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
- **Flows**: appears when the model has flows. Pick a flow from the tabs. **Focus** (on by default) fades everything outside the flow. **Play** runs it, **Step** moves one step, **Back** goes one step back, **Restart** resets, the slider scrubs to any step, and the speed menu offers 0.5x, 1x and 2x. A filled dot is a request; a hollow ring is a response travelling back. A step marked `together` in the model shows several dots at once. Events flash their component. The **Flow** tab lists the steps. Under reduced motion nothing moves by itself, Step jumps instantly, and Play is labelled "Play (uses motion)".

## Finding things

- Press `/` to search labels, technology, file paths, protocols and risk ids. Matches are highlighted, the rest fades, and the view centres on the first match. Arrow keys move through the results, Enter selects, Esc clears.
- **Trace path**: click a start component, then an end component. The panel lists every path that follows the direction of the connections, shortest first, with the hop count and the asynchronous segments marked (dotted on the diagram). Pick one to highlight it.
- The minimap in the corner shows the whole diagram and the part in view; click or drag it, or focus it and use the arrow keys.
- The address keeps the view: `#lens=flows&flow=login&step=2&node=redis&x=40&y=30&k=0.8`. Open the file with that address to land on the same view. The address only changes after you do something, and pages that cannot change it (some embedded frames) simply do not.

## Other controls

- Drag to pan, scroll or +/- to zoom, Fit to reset. With the diagram focused: arrow keys pan, `+` and `-` zoom, `0` fits.
- Components are keyboard focusable; Enter or Space selects.
- Light and dark follow the system; the button switches.
- On a narrow screen the diagram becomes a list of components.
- **Language and direction**: `render.mjs --lang ar` writes the Arabic interface (right to left; the panel and toolbar mirror). `--flow-dir rtl` also runs the diagram right to left. Text that comes from the project (labels, flow names, risk wording) stays as written. The Arabic interface text is a draft that needs a native speaker's review.

## Risks

The **Risks** tab lists every risk, each labelled "possible risk to check". Rule-based ones say they are heuristics when they are. They are prompts to look, not findings of fault, and the page never claims an architecture is best or correct.

The header says "Generated from code; not live traffic." The page shows how requests would travel according to the files read.
