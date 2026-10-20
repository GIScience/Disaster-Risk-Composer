# Story maps: where to change what

Each story map (`/story-map/<folder name>`) is built from three layers:

```
src/content/story-maps/
  _template/
    template.json        1. shared structure: what every story map has in common
    text.md                 + shared wording (buttons, chart labels, "Back to Dashboard" …)
  flood-exposure/
    config.json          2. what is special about this hazard: map layers, data files,
                            colours, numbers, which steps and buttons exist
    text.md              3. every text shown on the page, in page order
  cyclone-exposure/
    config.json
    text.md
```

The loader (`index.ts`, using `src/utils/story-map-content.ts`) merges them in this order:
template → hazard config → shared text → hazard text. The page layout and styling live in
the components in `src/components/story-map/`.

## I want to change a text

Open the hazard's `text.md` and change the text under the heading. That's all.

- Keep the `{…}` at the end of each heading: it says where the text goes. The words before
  it are only a description for you.
- `**bold**` and `[links](https://…)` work. Several paragraphs stay several paragraphs; lines
  starting with `- ` become a list.
- Words in curly braces inside a text, like `{n}` or `{threshold}`, are filled in by the page.
  Keep them.
- Text used by every story map (e.g. "See step →", the chart's "Low / Moderate / High") is in
  `_template/text.md`.

If a heading's `{…}` points to something that doesn't exist, the page fails to load and the
browser console names the line, e.g. `flood-exposure/text.md: "storyMap.sections.sec-x.title" -
no element "sec-x" in this list`.

## I want to change a map layer, data file, colour or number

Change the hazard's `config.json`. Things both hazards share (population layers, district
boundaries, the score chart step, icons) are in `_template/template.json`: a change there
affects every story map.

Numbers that also appear in the text (e.g. "about 1.9 million children" in a note, or a
legend entry "Up to 25,000") are written in `text.md` and have to be updated there by hand
when the data changes.

## I want to add a story map for a new hazard

1. Copy a hazard folder, e.g. `cyclone-exposure/` → `drought-exposure/`. The folder name is
   the URL.
2. In `config.json`, change `meta`, the layers and data files.
3. Rewrite `text.md`.
4. If it needs a new category filter, add it to `categories` in
   `src/pages/story-map/index.vue`.

## How the files fit together

- **Lists** (sections, buttons, steps …) are matched by `id`, `value`, `sectionRef` or `key`.
  The hazard's `config.json` decides their order. Elements only in the template come last.
- **In `text.md`**, a heading's `{path}` is relative to the closest heading above it with fewer
  `#`. For example:

  ```
  # Step 1: Choose a flood scenario {storyMap.sections.sec-flood}
  ## Button: 1-in-10 {control.options.10}
  ### Label {label}
  1-in-10
  ```

  This sets `storyMap.sections[sec-flood].control.options[10].label`. Headings without
  `{…}` are ignored.
- **Text inside the graphics** (e.g. the wind descriptions in step 2) comes from the `ui`
  blocks in `text.md` (`# Step 2 graphic: wind scene {ui.wind}`). The components read it with
  `useStoryText()`.
- The full field reference is in `docs/story-maps.md` and `src/types/story-map.ts`.

## Feedback via Confluence

Colleagues review the texts on Confluence. **Confluence does not update itself:** after
changing a `text.md`, run `npm run review-export` and paste the regenerated page into
Confluence by hand. The full workflow, with an example, is in
[docs/story-map-review/README.md](../../../docs/story-map-review/README.md).
