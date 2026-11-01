# Saving and printing the page

The **Export** menu in the page header offers:

- **SVG**: the whole diagram as one file, drawn as it looks now: the current view (System or Flows), theme, selection and faded parts. It is always drawn at full detail, whatever the zoom. Every style is written into the file, so it needs nothing else to display. It contains no scripts, links or fonts.
- **PNG at 1x, 2x or 3x**: that same SVG drawn on a canvas. A very large diagram is saved at a smaller scale (a side may not pass 16,000 px, nor the area 100 million px), and the page says so.
- **Model (JSON)**: the model embedded in the page (a version 1 model is saved as version 2).
- **Print or save as PDF**: page one is the diagram on a light background, whatever theme the page is in; the next pages list the possible risks. Pressing Ctrl or Cmd + P does the same.

Every picture carries a footer line inside it: the project name and "Generated from code; not live traffic." It is part of the image so the line stays with a screenshot that is shared on its own.

Labels, notes and paths are written into the SVG as escaped text, never as markup.

## Browsers

Checked in Chromium only: downloads, the SVG, PNG at three scales, JSON, and a PDF made from the print layout.

`TODO(verify)`: PNG export in Firefox and Safari, from a `file://` page. It draws the SVG through a `data:` address onto a canvas, which should not taint it, but this has not been run in those browsers. If it fails the page says "PNG export did not work in this browser. Use SVG instead." Saving may also be refused inside an embedded frame whose sandbox forbids downloads; the page then says so.
