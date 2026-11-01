# Layout and edge routing

`assets/lib/geometry.js` and `assets/lib/layout.js` are plain scripts with no DOM and no network. `render.mjs` pastes them into the page, and the tests load the same files, so what the tests check is what the page runs. The same model always gives the same coordinates: every tie is broken by id, so the order of nodes in the file does not matter.

1. **Columns** are tiers, in request order (clients, edge, frontend, backend, async, data, external). A node with an unknown tier goes in a last "Other" column.
2. **Long edges** get a one-lane slot in every column they cross, so they pass between boxes and never through one.
3. **Order** inside a column comes from eight barycenter sweeps; the order with the fewest crossings is kept.
4. **Groups** (`nodes[].group`, `groups[].parent`) are horizontal bands shared by all columns. A group's nodes therefore sit in one block and no other node can fall inside its box. Nodes without a group form their own band.
5. **Rows**: nodes are stacked in their band, then moved towards the middle of their neighbours.
6. **Routes** use only horizontal and vertical segments with rounded corners. Each vertical run between two columns has its own track, ordered to cross least. Ends are spread along the side of a box. Same-column and self edges loop through the gap on the right.
7. **Labels**: the protocol text is placed beside a line where it touches no box, line or other label; if no spot is free it is left out (`stats.labelsOmitted`).

`ArchLayout.layout(model)` returns `pos`, `layers`, `routes` (`points` and SVG path `d`), `groups`, `labels`, `size` and `stats`. `ArchGeometry.polylineCrossings` counts crossings; `edgesThroughNodes` lists edges that run through a box.
