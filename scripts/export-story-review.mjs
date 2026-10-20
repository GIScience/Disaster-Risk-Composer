/**
 * Export the story map texts as review pages to paste into Confluence.
 *
 * For every story map (src/content/story-maps/<id>/text.md) and for the shared wording
 * (_template/text.md) this writes docs/story-map-review/<id>.html: one table per part of the
 * page ("Step 1: …", "Sidebar", …) with "Where on the page" and "Text", formatted like on the
 * page. Rows that are new or changed since the last export are marked, and removed texts are
 * listed at the top, so the Confluence page can be updated and reviewers see what's new.
 *
 * Usage:
 *   npm run review-export              export and remember this state for the next comparison
 *   npm run review-export -- --dry-run export without updating the remembered state
 *
 * Then open the HTML file in a browser, select all (Cmd+A), copy and paste it into the
 * Confluence page, replacing the old content.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";
import MarkdownIt from "markdown-it";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const CONTENT = path.join(ROOT, "src/content/story-maps");
const OUT = path.join(ROOT, "docs/story-map-review");
const LIVE_URL = "https://disaster-risk-composer.heigit.org/#/story-map";
// Second link while the story maps aren't published on the live site yet (HeiGIT VPN only)
const STAGING_URL = "https://staging-dirc.heigitk8s.de/#/story-map";
const DRY_RUN = process.argv.includes("--dry-run");

// Same Markdown settings as the story map pages (RichText.vue)
const md = new MarkdownIt({ html: false, breaks: true, linkify: true });
const HEADING = /^(#{1,6})\s+(.*?)\s*(?:\{([^}]+)\})?\s*$/;

/**
 * Read a text.md into sections (level-1 headings) with rows. Each row has the full path (as
 * the story map loader builds it - used to recognise the same text between exports), a
 * readable "where" label from the headings, and the raw Markdown text.
 */
function readTextFile(file) {
  const lines = fs.readFileSync(file, "utf8").replace(/<!--[\s\S]*?-->/g, "").split("\n");
  const sections = [];
  const stack = []; // { level, key, title }
  let current = null; // row being filled
  let buffer = [];

  const flush = () => {
    const text = buffer.join("\n").trim();
    if (current && text) current.section.rows.push({ ...current, text });
    buffer = [];
  };

  for (const line of lines) {
    const m = line.match(HEADING);
    if (!m) {
      buffer.push(line);
      continue;
    }
    flush();
    const level = m[1].length;
    const title = m[2].trim();
    const key = m[3]?.trim();
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    stack.push({ level, key, title });
    if (level === 1) sections.push({ title, rows: [] });
    const section = sections[sections.length - 1];
    current =
      key && section
        ? {
            section,
            path: stack.flatMap((s) => (s.key ? s.key.split(".") : [])).join("."),
            where: stack.slice(1).map((s) => s.title).join(" › ") || title,
          }
        : null;
  }
  flush();
  return sections.filter((s) => s.rows.length);
}

const escapeHtml = (s) =>
  s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function gitInfo() {
  try {
    const hash = execSync("git rev-parse --short HEAD", { cwd: ROOT }).toString().trim();
    const dirty = execSync("git status --porcelain -- src/content/story-maps", { cwd: ROOT })
      .toString()
      .trim();
    return dirty ? `${hash} + uncommitted changes` : hash;
  } catch {
    return "unknown";
  }
}

function renderPage({ title, liveUrl, stagingUrl, sections, previous, removed }) {
  const date = new Date().toISOString().slice(0, 10);
  let changedCount = 0;
  const body = sections
    .map((section) => {
      const rows = section.rows
        .map((row) => {
          const before = previous?.[row.path];
          const status = !previous ? "" : before === undefined ? "new" : before !== row.text ? "changed" : "";
          if (status) changedCount += 1;
          const mark = status
            ? `<strong style="color:#b45309">${status === "new" ? "NEW" : "CHANGED"}</strong>`
            : "";
          return `<tr><td>${escapeHtml(row.where)}</td><td>${md.render(row.text)}</td><td>${mark}</td></tr>`;
        })
        .join("\n");
      return `<h2>${escapeHtml(section.title)}</h2>
<table>
<thead><tr><th style="width:28%">Where on the page</th><th>Text</th><th style="width:9%">Since last version</th></tr></thead>
<tbody>
${rows}
</tbody>
</table>`;
    })
    .join("\n\n");

  const changes = !previous
    ? "<p>First export: no comparison with an earlier version.</p>"
    : `<p><strong>${changedCount} text${changedCount === 1 ? "" : "s"} new or changed</strong> since the last version (marked in the last column).${
        removed.length
          ? ` Removed: ${removed.map((r) => `<em>${escapeHtml(r)}</em>`).join(", ")}.`
          : ""
      }</p>`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)} – text for review</title>
<style>
  body { font-family: system-ui, sans-serif; max-width: 60rem; margin: 2rem auto; padding: 0 1rem; color: #1f2937; }
  table { border-collapse: collapse; width: 100%; margin-bottom: 1.5rem; }
  th, td { border: 1px solid #d1d5db; padding: 6px 8px; vertical-align: top; text-align: left; }
  th { background: #f3f4f6; }
  td p { margin: 0 0 0.4em; }
  .note { background: #eff6ff; border: 1px solid #bfdbfe; padding: 10px 14px; }
</style>
</head>
<body>
<h1>${escapeHtml(title)} – text for review</h1>
<div class="note">
<p><strong>Please don't edit this page, comment instead:</strong> select a passage and add an inline comment, or leave a comment at the bottom.</p>
<p>This page is generated from the dashboard's story map texts (version of ${date}, ${escapeHtml(gitInfo())}) and is replaced when the texts change. ${
    liveUrl
      ? `See the texts in context: <a href="${liveUrl}">${liveUrl}</a>${
          stagingUrl
            ? ` (if the story maps aren't published there yet: <a href="${stagingUrl}">${stagingUrl}</a>, only reachable via the HeiGIT VPN)`
            : ""
        }.`
      : ""
  } Words in curly braces, such as {n}, are filled in by the page.</p>
</div>
${changes}
${body}
</body>
</html>
`;
}

function exportOne(id, file, title, liveUrl, stagingUrl) {
  const sections = readTextFile(file);
  const snapshotFile = path.join(OUT, `${id}.snapshot.json`);
  const previous = fs.existsSync(snapshotFile) ? JSON.parse(fs.readFileSync(snapshotFile, "utf8")) : null;
  const current = Object.fromEntries(sections.flatMap((s) => s.rows.map((r) => [r.path, r.text])));
  const whereByPath = Object.fromEntries(sections.flatMap((s) => s.rows.map((r) => [r.path, `${s.title} › ${r.where}`])));
  const removed = previous ? Object.keys(previous).filter((k) => !(k in current)) : [];

  fs.writeFileSync(path.join(OUT, `${id}.html`), renderPage({ title, liveUrl, stagingUrl, sections, previous, removed }));
  if (!DRY_RUN) fs.writeFileSync(snapshotFile, JSON.stringify(current, null, 1) + "\n");

  const changed = previous
    ? Object.keys(current).filter((k) => previous[k] !== current[k]).map((k) => whereByPath[k])
    : [];
  console.log(`${id}: ${Object.keys(current).length} texts -> docs/story-map-review/${id}.html`);
  if (previous) {
    if (!changed.length && !removed.length) console.log("  no changes since the last export");
    changed.forEach((w) => console.log(`  changed: ${w}`));
    removed.forEach((k) => console.log(`  removed: ${k}`));
  }
}

fs.mkdirSync(OUT, { recursive: true });
for (const id of fs.readdirSync(CONTENT).filter((d) => !d.startsWith("_") && fs.existsSync(path.join(CONTENT, d, "text.md")))) {
  const text = fs.readFileSync(path.join(CONTENT, id, "text.md"), "utf8");
  // Page title from the sidebar title in text.md, e.g. "Cyclone Exposure Story Map"
  const sidebarTitle = text.match(/# Sidebar \{storyMap\.sidebar\}\s+## Title \{title\}\s+(.+)/)?.[1]?.trim() ?? id;
  exportOne(id, path.join(CONTENT, id, "text.md"), sidebarTitle, `${LIVE_URL}/${id}`, `${STAGING_URL}/${id}`);
}
exportOne("shared-wording", path.join(CONTENT, "_template/text.md"), "Story maps: shared wording", LIVE_URL, STAGING_URL);
if (DRY_RUN) console.log("(dry run: the state for the next comparison was not updated)");
