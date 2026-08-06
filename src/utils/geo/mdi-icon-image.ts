const glyphCache = new Map<string, string | null>();

function getMdiGlyph(iconName: string): string | null {
  const cached = glyphCache.get(iconName);
  if (cached !== undefined) return cached;

  const el = document.createElement("i");
  el.className = `mdi ${iconName}`;
  el.style.position = "absolute";
  el.style.visibility = "hidden";
  document.body.appendChild(el);
  const content = getComputedStyle(el, "::before").content;
  document.body.removeChild(el);

  const glyph =
    content && content !== "none" && content !== "normal"
      ? content.replace(/^["']|["']$/g, "")
      : null;
  glyphCache.set(iconName, glyph);
  return glyph;
}

export interface RenderMdiIconOptions {
  size?: number;
  color?: string;
}


export async function renderMdiIconImage(
  iconName: string,
  options: RenderMdiIconOptions = {},
): Promise<ImageData | null> {
  const glyph = getMdiGlyph(iconName);
  if (!glyph) return null;

  const size = options.size ?? 48;
  const fontSize = Math.round(size * 0.82);
  const font = `${fontSize}px "Material Design Icons"`;

  try {
    await document.fonts.load(font, glyph);
  } catch {

  }

  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.clearRect(0, 0, size, size);
  ctx.font = font;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = options.color ?? "#1f2937";
  ctx.fillText(glyph, size / 2, size / 2 + 1);

  return ctx.getImageData(0, 0, size, size);
}
