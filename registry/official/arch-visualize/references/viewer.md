# The page (`docs/architecture.html`)

One self-contained file. It makes no network requests (no CDN, fonts, icons or analytics), so it works offline from `file://`. The model and icons are embedded as data. Labels, notes and file paths are shown as text, never as HTML.

## Reading the diagram

- Columns run left to right by tier: Clients, Edge, Frontend, Backend, Async, Data, External. Empty tiers disappear.
- Each box has the technology icon, the label and the technology. A small orange number is the count of possible risks that name that component.
- A solid outline or line is backed by files. **Dashed** means inferred: the model says it exists but no file shows it.
- Select a component or a connection to see its role, technology, evidence (`file:line`), connections and risks in the side panel.

## Request flows

- Pick a flow from the tabs above the diagram. Components outside the flow fade.
- **Play** runs the whole flow, **Step** moves one step, **Back** goes one step back, **Restart** resets, and the speed menu offers 0.5x, 1x and 2x.
- A filled dot is a request; a hollow ring is a response travelling back. The caption names the step and says Request or Response.
- Events flash their component. The **Flow** tab in the panel lists the steps; click one to jump to it.
- If the system asks for reduced motion, nothing moves by itself. Step jumps instantly, and Play is labelled "Play (uses motion)": pressing it is a choice to see animation.

## Other controls

- Drag to pan, scroll or +/- to zoom, Fit to reset. With the diagram focused: arrow keys pan, `+` and `-` zoom, `0` fits.
- Components are keyboard focusable; Enter or Space selects.
- Light and dark follow the system; the button switches.
- On a narrow screen the diagram becomes a list of components; Step and Back still work and the caption follows them.

## Risks

The **Risks** tab lists every risk, each labelled "possible risk to check". Rule-based ones say they are heuristics when they are. They are prompts to look, not findings of fault, and the page never claims an architecture is best or correct.

The header says "Generated from code; not live traffic." The page shows how requests would travel according to the files read.
