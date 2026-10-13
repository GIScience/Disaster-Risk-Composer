/**
 * Builds a story map from its three layers (see src/content/story-maps/README.md):
 *   1. the shared template (_template/template.json + _template/text.md),
 *   2. the hazard's config.json (layers, data files, colours, numbers - no prose),
 *   3. the hazard's text.md (every text shown on the page).
 *
 * text.md format: every heading that ends in `{path}` says where the text below it goes. Paths
 * are relative to the closest heading above with a lower level, e.g.
 *
 *   # Step 1: Choose a flood scenario {storyMap.sections.sec-flood}
 *   ## Button: 1-in-10 {control.options.10}
 *   ### Label {label}
 *   1-in-10
 *
 * Array elements are addressed by their `id`, `value`, `sectionRef` or `key` (or by index).
 * Text under a heading becomes a string; several paragraphs or a "- " list become an array.
 * Headings without `{path}` and HTML comments are ignored.
 */

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };
type JsonObject = { [key: string]: Json };
export type TextEntry = { path: string[]; value: string | string[] };

const ID_KEYS = ["id", "value", "sectionRef", "key"] as const;

function isObject(v: unknown): v is JsonObject {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function identOf(v: Json): string | undefined {
  if (!isObject(v)) return undefined;
  for (const k of ID_KEYS) if (v[k] !== undefined && v[k] !== null) return String(v[k]);
  return undefined;
}

// ---------------------------------------------------------------- text.md

const HEADING = /^(#{1,6})\s+(.*?)\s*(?:\{([^}]+)\})?\s*$/;

function parseValue(raw: string): string | string[] | null {
  const text = raw.trim();
  if (!text) return null;
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.every((l) => /^\s*- /.test(l))) return lines.map((l) => l.replace(/^\s*- /, "").trim());
  const paragraphs = text
    .split(/\n\s*\n/)
    .map((p) => p.split("\n").map((l) => l.trim()).join(" ").trim())
    .filter(Boolean);
  return paragraphs.length === 1 ? paragraphs[0] : paragraphs;
}

export function parseStoryText(markdown: string): TextEntry[] {
  const entries: TextEntry[] = [];
  const stack: { level: number; key?: string }[] = [];
  let current: { path: string[] } | null = null;
  let buffer: string[] = [];

  const flush = () => {
    if (current) {
      const value = parseValue(buffer.join("\n"));
      if (value !== null) entries.push({ path: current.path, value });
    }
    buffer = [];
  };

  const lines = markdown.replace(/<!--[\s\S]*?-->/g, "").split("\n");
  lines.forEach((line) => {
    const m = line.match(HEADING);
    if (!m) {
      buffer.push(line);
      return;
    }
    flush();
    const level = m[1].length;
    while (stack.length && stack[stack.length - 1].level >= level) stack.pop();
    const key = m[3]?.trim();
    stack.push({ level, key });
    current = key ? { path: stack.flatMap((s) => (s.key ? s.key.split(".") : [])) } : null;
  });
  flush();
  return entries;
}

function setPath(root: JsonObject, path: string[], value: Json, source: string) {
  let node: Json = root;
  path.forEach((seg, i) => {
    const last = i === path.length - 1;
    if (Array.isArray(node)) {
      let idx = node.findIndex((el) => identOf(el) === seg);
      if (idx === -1 && /^\d+$/.test(seg) && Number(seg) < node.length) idx = Number(seg);
      if (idx === -1)
        throw new Error(`${source}: "${path.join(".")}" - no element "${seg}" in this list`);
      if (last) node[idx] = value;
      else node = node[idx];
      return;
    }
    if (!isObject(node)) throw new Error(`${source}: "${path.join(".")}" - "${seg}" is not an object`);
    if (last) {
      node[seg] = value;
      return;
    }
    if (node[seg] === undefined) node[seg] = {};
    node = node[seg];
  });
}

export function applyStoryText(config: JsonObject, entries: TextEntry[], source = "text.md") {
  for (const e of entries) setPath(config, e.path, e.value, source);
  return config;
}

// ---------------------------------------------------------------- template merge

/**
 * Deep-merges the hazard config over the template. Lists whose elements have an id/value/key are
 * merged element by element: the hazard decides the order, template-only elements come last.
 */
export function mergeTemplate(template: Json, own: Json): Json {
  if (own === undefined) return structuredClone(template);
  if (Array.isArray(template) && Array.isArray(own)) {
    const identified = [...template, ...own].every((el) => identOf(el) !== undefined);
    if (!identified) return structuredClone(own);
    const merged = own.map((el) => {
      const match = template.find((t) => identOf(t) === identOf(el));
      return match === undefined ? structuredClone(el) : mergeTemplate(match, el);
    });
    for (const t of template)
      if (!own.some((el) => identOf(el) === identOf(t))) merged.push(structuredClone(t));
    return merged;
  }
  if (isObject(template) && isObject(own)) {
    const out: JsonObject = structuredClone(template);
    for (const [k, v] of Object.entries(own)) out[k] = k in template ? mergeTemplate(template[k], v) : structuredClone(v);
    return out;
  }
  return structuredClone(own);
}

export function buildStoryMap(parts: {
  template: object;
  templateText: string;
  config: object;
  text: string;
  name: string;
}): JsonObject {
  const merged = mergeTemplate(parts.template as Json, parts.config as Json) as JsonObject;
  applyStoryText(merged, parseStoryText(parts.templateText), "_template/text.md");
  applyStoryText(merged, parseStoryText(parts.text), `${parts.name}/text.md`);
  return merged;
}

// ---------------------------------------------------------------- UI wording for components

/** Looks up a dotted key in the `ui` texts and fills in {placeholders}. */
export function uiText(
  ui: Record<string, unknown> | undefined,
  key: string,
  vars: Record<string, string | number> = {},
): string {
  let v: unknown = ui;
  for (const seg of key.split(".")) v = isObject(v as Json) ? (v as JsonObject)[seg] : undefined;
  if (typeof v !== "string") {
    if (import.meta.env?.DEV) console.warn(`Story map text missing: ui.${key}`);
    return key;
  }
  return v.replace(/\{(\w+)\}/g, (_, name) => (name in vars ? String(vars[name]) : `{${name}}`));
}

/** Same as uiText, for keys holding a list. */
export function uiList(ui: Record<string, unknown> | undefined, key: string): string[] {
  let v: unknown = ui;
  for (const seg of key.split(".")) v = isObject(v as Json) ? (v as JsonObject)[seg] : undefined;
  return Array.isArray(v) ? (v as string[]) : [];
}
