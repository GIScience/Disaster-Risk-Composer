# Story map feedback via Confluence

Colleagues review the texts of the story maps on Confluence and leave comments there. This
folder holds the pages that get pasted into Confluence. This guide explains how the texts get
from the repo to Confluence and back.

## The most important point

**Confluence does not update itself.** There is no connection between the repo and
Confluence (we can't use the Confluence API). The Confluence pages are a **copy** that someone
updates by hand: run one command, then copy and paste.

| Where | What it is | When it changes |
|---|---|---|
| `src/content/story-maps/<id>/text.md` | **the original text** of a story map | when someone edits it |
| the story map on the website | shows the text from `text.md` | automatically, with the next deploy |
| `docs/story-map-review/<id>.html` (this folder) | a review page generated from `text.md` | when you run `npm run review-export` |
| the Confluence page | a **copy** of the review page, for comments | **only when someone pastes the new HTML** |

Texts are only ever changed in `text.md`, never on Confluence. Changes made on Confluence
would be overwritten by the next paste and never reach the website.

## What's in this folder

| File | What it is |
|---|---|
| `flood-exposure.html` | review page for the flood story map → Confluence page "Flood" |
| `cyclone-exposure.html` | review page for the cyclone story map → Confluence page "Cyclone" |
| `shared-wording.html` | wording used by every story map (buttons, chart labels) → optional third page |
| `*.snapshot.json` | the state of the texts at the last export, i.e. what's on Confluence now. Used to mark what changed. Don't edit by hand. |

Each review page has a note at the top (please comment, don't edit; links to the story map),
then one table per part of the story map ("Sidebar", "Step 1: …", "Step 2 graphic: …") with
three columns:

- **Where on the page**, e.g. "Button: Intensity 3 › Key figure text";
- **Text**, formatted as on the page (bold, links, lists);
- **Since last version**: **NEW** or **CHANGED** if the text differs from the last export.

## Workflow

### First time

1. Create one Confluence page per story map (and optionally one for the shared wording).
2. In the repo, run:
   ```bash
   npm run review-export
   ```
3. Open `docs/story-map-review/flood-exposure.html` **in a browser**, e.g. with
   `open docs/story-map-review/flood-exposure.html` or by double-clicking it in Finder. In the
   browser, select all (Cmd+A), copy (Cmd+C), and paste into the Confluence page "Flood".
   Publish. Do the same for the cyclone page (and the shared wording).

   > **Copy from the browser, not from the code editor.** Opening the `.html` file in VS Code
   > shows its source code; copying that pastes raw HTML tags into Confluence. Only the page
   > as the browser shows it turns into headings and tables when pasted.
4. Commit this folder (`docs/story-map-review/`, including the `*.snapshot.json` files).
5. Tell colleagues where the pages are. They comment by selecting a passage and adding an
   inline comment, or with a comment at the bottom of the page.

### Every time the texts change

1. **Change the text** in `src/content/story-maps/<id>/text.md` (see
   [the story maps README](../../src/content/story-maps/README.md) for how that file works).
2. **Run the export:**
   ```bash
   npm run review-export
   ```
   It reads the current `text.md` files and **regenerates all HTML pages** in this folder,
   including changes you haven't committed yet. The terminal lists what changed since the
   last export.
3. **Update Confluence by hand** for every story map with changes: open its HTML file in the
   browser, select all, copy, edit the Confluence page, select all, paste (this replaces the
   old content), publish. Pages the terminal reports as "no changes" can be skipped.
4. **Commit this folder.** The export saved the new state in `*.snapshot.json`, so the next
   export compares against what's on Confluence now, no matter who runs it.

`npm run review-export -- --dry-run` regenerates the HTML without saving that state, e.g. to
look at the result before pasting. Use the normal command when you actually paste, otherwise
the next export compares against an older version.

## Example

A colleague comments on the cyclone page, step 2, on "count as exposed": *"Explain what
'exposed' means here."*

1. In `src/content/story-maps/cyclone-exposure/text.md`, under `## Info box {note.body}` in the
   step 2 block, you add the words "i.e. people living there are counted in the indicator":

   > Only places with winds of **at least 34 knots** (63 km/h) count as exposed, i.e. people
   > living there are counted in the indicator.

   After the next deploy the website shows the new sentence. **Confluence still shows the old
   one.**

2. `npm run review-export` prints:
   ```
   cyclone-exposure: 159 texts -> docs/story-map-review/cyclone-exposure.html
     changed: Step 2: Apply the wind threshold › Info box
   flood-exposure: 149 texts -> docs/story-map-review/flood-exposure.html
     no changes since the last export
   shared-wording: 24 texts -> docs/story-map-review/shared-wording.html
     no changes since the last export
   ```
   So only the cyclone page needs updating.

3. You open `cyclone-exposure.html`, copy everything, and paste it over the Confluence page
   "Cyclone". The page now says at the top "1 text new or changed since the last version", and
   the row shows the new sentence marked **CHANGED**.

4. You commit `docs/story-map-review/`.

5. The colleague's comment has lost its anchor, because the sentence it was attached to changed.
   Confluence keeps it in the page's comment list; reply ("done") and resolve it.

## Comments when a page is replaced

- Inline comments on text that **changed** lose their anchor when the page is replaced. They
  stay in the page's comment list. That fits: usually the change answers the comment.
- Inline comments on text that **didn't change** should stay in place. Check this after the
  first update; if they get lost too, paste less often (collect several changes first).
- Comments at the bottom of the page are not affected.

## Links in the review pages

The note at the top links to the story map on the live site
(https://disaster-risk-composer.heigit.org/#/story-map) and, while the story maps aren't
published there yet, to the staging version (https://staging-dirc.heigitk8s.de/#/story-map),
which is **only reachable via the HeiGIT VPN**.

## Troubleshooting

| Problem | What to do |
|---|---|
| Everything is marked NEW | No saved state yet (first export), or the `*.snapshot.json` files weren't committed and someone else exported. Paste as usual; the next export compares correctly. |
| A change isn't marked | The previous export ran without `--dry-run` after the change, so the state already includes it. The text on the page is still correct. |
| Confluence shows raw HTML (`<table>`, `<tr>` …) | You copied the source code from the editor. Open the file in a browser and copy from there (see "First time", step 3). |
| Tables look broken after pasting | Paste into the Confluence editor, not into a code block. If it still breaks, report it so the HTML can be simplified. |
| A label in "Where on the page" is unclear | The labels are the heading words in `text.md` (before the `{…}`). Rename them there; only the words before `{…}` may change. |

## Technical details

- Script: [`scripts/export-story-review.mjs`](../../scripts/export-story-review.mjs), started by
  `npm run review-export` (see `package.json`).
- It reads `src/content/story-maps/<id>/text.md` for every story map and
  `src/content/story-maps/_template/text.md` for the shared wording, and renders the text with
  markdown-it, the same library the story map pages use.
- A text is recognised between exports by its `{…}` path, so renaming a heading's description
  doesn't mark it as changed.
- The links at the top are set at the start of the script (`LIVE_URL`, `STAGING_URL`).
