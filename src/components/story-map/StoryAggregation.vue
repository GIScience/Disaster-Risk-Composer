<script setup lang="ts">
import { computed, ref } from "vue";
import { useStoryText } from "@/composables/useStoryText";

/**
 * kind "raster": people from a population grid (WorldPop) - every cell carries a count.
 * kind "points": facilities from OpenStreetMap - individual points, counted when inside the
 * hazard area (water deeper than 30 cm, or the 34-knot wind zone).
 */
const props = withDefaults(
  defineProps<{ kind?: "raster" | "points"; hazard?: "flood" | "cyclone" }>(),
  { kind: "raster", hazard: "flood" },
);
// Wording comes from text.md (ui.aggregation.*), so each hazard describes its own hazard area
const { t } = useStoryText();
// Colour of the hazard area in the facilities view
const zone = computed(() => ({ fill: props.hazard === "cyclone" ? "#ddd6fe" : "#bfdbfe" }));

/**
 * How grid cells become district numbers: (1) people per ~100 m cell with the hazard area on top
 * (only cells inside it count), (2) district borders laid over the grid, (3) the counted cells
 * inside each district added up. Values are made up for illustration; hovering a district
 * highlights its cells.
 */
const COLS = 8;
const ROWS = 6;
const CELL = 30;

// Flood water per cell: 0 = dry, 1 = shallow (30 cm or less, not counted), 2 = deeper than 30 cm.
// A flood band runs through the middle.
const DEPTH = [
  [0, 0, 1, 1, 1, 0, 0, 0],
  [0, 1, 2, 2, 2, 1, 0, 0],
  [1, 1, 2, 2, 2, 1, 1, 0],
  [0, 1, 2, 2, 2, 2, 2, 1],
  [0, 0, 1, 2, 2, 2, 2, 1],
  [0, 0, 0, 1, 1, 2, 2, 1],
];
// District of each cell (irregular borders, like real ones)
const DISTRICT = [
  "AAABBBBB",
  "AAABBBBB",
  "AAAABBBB",
  "AACCCBBB",
  "ACCCCCBB",
  "CCCCCCCB",
];
const DISTRICTS = computed(() =>
  ["A", "B", "C"].map((id) => ({ id, name: t("aggregation.district", { id }) })),
);

const hovered = ref<string | null>(null);

const FLOODED = DEPTH.map((row) => row.map((d) => d === 2));
const SHALLOW = DEPTH.map((row) => row.map((d) => d === 1));

// Outline of the area deeper than 30 cm: a cell edge wherever a deep cell meets a non-deep one
const floodEdges = (() => {
  const deep = (r: number, c: number) => r >= 0 && r < ROWS && c >= 0 && c < COLS && FLOODED[r][c];
  const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      if (!FLOODED[r][c]) continue;
      const x = c * CELL;
      const y = r * CELL;
      if (!deep(r - 1, c)) segs.push({ x1: x, y1: y, x2: x + CELL, y2: y });
      if (!deep(r + 1, c)) segs.push({ x1: x, y1: y + CELL, x2: x + CELL, y2: y + CELL });
      if (!deep(r, c - 1)) segs.push({ x1: x, y1: y, x2: x, y2: y + CELL });
      if (!deep(r, c + 1)) segs.push({ x1: x + CELL, y1: y, x2: x + CELL, y2: y + CELL });
    }
  return segs;
})();
// Wind zone for the cyclone version, built like GAIA does it: every track segment gets a corridor
// with its own 34-knot radius (round ends), and the zone is the union of these corridors. Inside,
// the wind is only known to be at least 34 knots, so the zone has one colour.
const TRACK: [number, number][] = [
  [-20, 168],
  [70, 128],
  [150, 72],
  [260, 26],
];
// 34-knot radius of each segment (the storm's wind field grows as it moves on)
const RADII = [26, 32, 38];
const SEGMENTS = RADII.map((r, i) => ({
  d: `M${TRACK[i].join(" ")} L${TRACK[i + 1].join(" ")}`,
  r,
}));
const trackPath = `M${TRACK.map((p) => p.join(" ")).join(" L")}`;

// Inside the zone = within the 34-knot radius of at least one segment
function inWindZone(x: number, y: number) {
  for (let i = 0; i < TRACK.length - 1; i++) {
    const [ax, ay] = TRACK[i];
    const [bx, by] = TRACK[i + 1];
    const t = Math.max(
      0,
      Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)),
    );
    if (Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))) < RADII[i]) return true;
  }
  return false;
}

// Facilities: scattered points (fixed pseudo-random positions, so the picture is stable)
const FACILITY_TYPES = ["school", "hospital", "clinic"] as const;
const facilities = (() => {
  let seed = 7;
  const rand = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
  const pts: { x: number; y: number; type: (typeof FACILITY_TYPES)[number]; district: string; flooded: boolean; windy: boolean }[] = [];
  while (pts.length < 26) {
    const x = 6 + rand() * (COLS * CELL - 12);
    const y = 6 + rand() * (ROWS * CELL - 12);
    if (pts.some((p) => Math.hypot(p.x - x, p.y - y) < 17)) continue; // keep them apart
    const c = Math.floor(x / CELL);
    const r = Math.floor(y / CELL);
    pts.push({
      x,
      y,
      type: FACILITY_TYPES[Math.floor(rand() * 3)],
      district: DISTRICT[r][c],
      flooded: FLOODED[r][c],
      windy: inWindZone(x, y),
    });
  }
  return pts;
})();

const exposed = (f: (typeof facilities)[number]) =>
  props.hazard === "cyclone" ? f.windy : f.flooded;

// Children live in every cell. A cell counts when the water there is deeper than 30 cm (flood),
// or when its centre lies in the wind zone (cyclone, as in GAIA); the others are left out.
const POP = [
  [3, 5, 8, 6, 4, 2, 3, 1],
  [4, 9, 14, 11, 7, 4, 2, 2],
  [6, 12, 22, 18, 10, 6, 4, 3],
  [5, 10, 16, 25, 19, 9, 5, 2],
  [3, 6, 9, 14, 21, 13, 7, 4],
  [2, 3, 5, 8, 12, 15, 9, 5],
];
const uid = Math.random().toString(36).slice(2, 8); // unique ids for the SVG masks

const cells = computed(() =>
  POP.flatMap((row, r) =>
    row.map((value, c) => ({
      r,
      c,
      value,
      district: DISTRICT[r][c],
      counted:
        props.hazard === "cyclone"
          ? inWindZone((c + 0.5) * CELL, (r + 0.5) * CELL)
          : FLOODED[r][c],
      shallow: props.hazard !== "cyclone" && SHALLOW[r][c],
    })),
  ),
);

function cellColor(v: number, counted = true, shallow = false) {
  if (!counted) return shallow ? "#dbeafe" : "#eef1f4";
  if (v === 0) return "#f1f5f9";
  if (v < 5) return "#f9d5b6";
  if (v < 12) return "#f6a44d";
  if (v < 20) return "#e86b3e";
  return "#cc0130";
}

const totals = computed(() =>
  DISTRICTS.value.map((d) => ({
    ...d,
    total:
      props.kind === "points"
        ? facilities.filter((f) => f.district === d.id && exposed(f)).length
        : cells.value
            .filter((c) => c.district === d.id && c.counted)
            .reduce((s, c) => s + c.value, 0),
  })),
);
const maxTotal = computed(() => Math.max(...totals.value.map((t) => t.total)));

// District outlines: draw a cell edge wherever the neighbouring cell belongs to another district
const borders = computed(() => {
  const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const d = DISTRICT[r][c];
      const x = c * CELL;
      const y = r * CELL;
      if (r === 0 || DISTRICT[r - 1][c] !== d) segs.push({ x1: x, y1: y, x2: x + CELL, y2: y });
      if (c === 0 || DISTRICT[r][c - 1] !== d) segs.push({ x1: x, y1: y, x2: x, y2: y + CELL });
      if (r === ROWS - 1) segs.push({ x1: x, y1: y + CELL, x2: x + CELL, y2: y + CELL });
      if (c === COLS - 1) segs.push({ x1: x + CELL, y1: y, x2: x + CELL, y2: y + CELL });
    }
  return segs;
});

// Label position: centre of each district's cells
function labelPos(id: string) {
  const own = cells.value.filter((c) => c.district === id);
  const cx = own.reduce((s, c) => s + c.c, 0) / own.length;
  const cy = own.reduce((s, c) => s + c.r, 0) / own.length;
  return { x: (cx + 0.5) * CELL, y: (cy + 0.5) * CELL };
}
</script>

<template>
  <div class="grid grid-cols-1 items-start gap-6 sm:grid-cols-3">
    <!-- 1. input data -->
    <figure class="m-0">
      <figcaption class="mb-2 text-xs font-semibold text-gray-700">
        <span class="text-heigit-red">1.</span>
        {{ t(`aggregation.${kind}.caption`) }}
      </figcaption>
      <svg
        :viewBox="`0 0 ${COLS * CELL} ${ROWS * CELL + 24}`"
        class="w-full rounded"
      >
        <template v-if="kind === 'points'">
          <rect :width="COLS * CELL" :height="ROWS * CELL" fill="#f8fafc" />
          <rect
            v-for="cell in cells.filter((c) => hazard !== 'cyclone' && DEPTH[c.r][c.c] > 0)"
            :key="`f-${cell.r}-${cell.c}`"
            :x="cell.c * CELL"
            :y="cell.r * CELL"
            :width="CELL + 0.5"
            :height="CELL + 0.5"
            :fill="FLOODED[cell.r][cell.c] ? zone.fill : '#dbeafe'"
          />
          <!-- wind zone: one corridor per track segment, edges at the 34-knot radius -->
          <g v-if="hazard === 'cyclone'" fill="none" stroke-linecap="round">
            <path v-for="(g, i) in SEGMENTS" :key="`e${i}`" :d="g.d" stroke="#8b5cf6" :stroke-width="g.r * 2 + 3" />
            <path v-for="(g, i) in SEGMENTS" :key="`z${i}`" :d="g.d" :stroke="zone.fill" :stroke-width="g.r * 2" />
            <path :d="trackPath" stroke="#7c3aed" stroke-width="1.5" stroke-dasharray="5 4" stroke-linejoin="round" />
          </g>
          <line
            v-for="(e, i) in hazard !== 'cyclone' ? floodEdges : []"
            :key="`pe-${i}`"
            v-bind="e"
            stroke="#2563eb"
            stroke-width="2.5"
            stroke-linecap="round"
          />
          <g v-for="(f, i) in facilities" :key="i" :transform="`translate(${f.x} ${f.y})`">
            <circle r="6.5" :fill="exposed(f) ? '#cc0130' : '#94a3b8'" stroke="white" stroke-width="1.5" />
            <path v-if="f.type === 'hospital'" d="M-3 0 H3 M0 -3 V3" stroke="white" stroke-width="1.8" />
            <rect v-else-if="f.type === 'school'" x="-2.5" y="-2.5" width="5" height="5" fill="white" />
            <circle v-else r="2.2" fill="white" />
          </g>
          <!-- flood: outline of the water deeper than 30 cm, drawn under the points' halo -->
          <template v-if="hazard !== 'cyclone'">
            <!-- key under the grid -->
            <g :transform="`translate(0 ${ROWS * CELL + 14})`" class="pointer-events-none">
              <line x1="2" x2="22" y1="0" y2="0" stroke="#2563eb" stroke-width="2.5" />
              <text x="27" y="4" class="fill-blue-700 text-[10px] font-bold">{{ t("aggregation.key.area") }}</text>
              <rect x="128" y="-6" width="12" height="12" rx="2" fill="#dbeafe" />
              <text x="145" y="4" class="fill-slate-500 text-[10px]">{{ t("aggregation.key.other") }}</text>
            </g>
          </template>
          <template v-else>
            <!-- key under the grid -->
            <g :transform="`translate(0 ${ROWS * CELL + 14})`" class="pointer-events-none">
              <line x1="2" x2="22" y1="0" y2="0" stroke="#7c3aed" stroke-width="2" />
              <text x="27" y="4" class="fill-violet-700 text-[10px] font-bold">{{ t("aggregation.key.area") }}</text>
              <line x1="110" x2="130" y1="0" y2="0" stroke="#7c3aed" stroke-width="1.5" stroke-dasharray="5 4" />
              <text x="135" y="4" class="fill-slate-500 text-[10px]">{{ t("aggregation.key.other") }}</text>
            </g>
          </template>
        </template>
        <template v-else>
          <g v-for="cell in cells" :key="`${cell.r}-${cell.c}`">
            <rect
              :x="cell.c * CELL + 1"
              :y="cell.r * CELL + 1"
              :width="CELL - 2"
              :height="CELL - 2"
              rx="3"
              :fill="cellColor(cell.value, cell.counted, cell.shallow)"
            />
            <text
              v-if="cell.value"
              :x="cell.c * CELL + CELL / 2"
              :y="cell.r * CELL + CELL / 2 + 4"
              text-anchor="middle"
              class="text-[11px] font-semibold"
              :class="!cell.counted ? 'fill-slate-400' : cell.value >= 12 ? 'fill-white' : 'fill-slate-700'"
            >
              {{ cell.value }}
            </text>
          </g>
          <!-- flood over the grid: outline of the water deeper than 30 cm -->
          <template v-if="hazard !== 'cyclone'">
            <line
              v-for="(e, i) in floodEdges"
              :key="`fe-${i}`"
              v-bind="e"
              stroke="#2563eb"
              stroke-width="2.5"
              stroke-linecap="round"
              class="pointer-events-none"
            />
            <!-- key under the grid -->
            <g :transform="`translate(0 ${ROWS * CELL + 14})`" class="pointer-events-none">
              <line x1="2" x2="22" y1="0" y2="0" stroke="#2563eb" stroke-width="2.5" />
              <text x="27" y="4" class="fill-blue-700 text-[10px] font-bold">{{ t("aggregation.key.area") }}</text>
              <rect x="128" y="-6" width="12" height="12" rx="2" fill="#dbeafe" />
              <text x="145" y="4" class="fill-slate-500 text-[10px]">{{ t("aggregation.key.other") }}</text>
            </g>
          </template>
          <!-- wind zone over the grid: its 34-knot edge and the storm track -->
          <template v-if="hazard === 'cyclone'">
            <mask :id="`ring-a-${uid}`">
              <g fill="none" stroke-linecap="round">
                <path v-for="(g, i) in SEGMENTS" :key="`w${i}`" :d="g.d" stroke="white" :stroke-width="g.r * 2 + 3" />
                <path v-for="(g, i) in SEGMENTS" :key="`b${i}`" :d="g.d" stroke="black" :stroke-width="g.r * 2" />
              </g>
            </mask>
            <rect :width="COLS * CELL" :height="ROWS * CELL" fill="#7c3aed" :mask="`url(#ring-a-${uid})`" class="pointer-events-none" />
            <path :d="trackPath" fill="none" stroke="#7c3aed" stroke-width="1.5" stroke-dasharray="5 4" class="pointer-events-none" />
            <!-- key under the grid -->
            <g :transform="`translate(0 ${ROWS * CELL + 14})`" class="pointer-events-none">
              <line x1="2" x2="22" y1="0" y2="0" stroke="#7c3aed" stroke-width="2" />
              <text x="27" y="4" class="fill-violet-700 text-[10px] font-bold">{{ t("aggregation.key.area") }}</text>
              <line x1="110" x2="130" y1="0" y2="0" stroke="#7c3aed" stroke-width="1.5" stroke-dasharray="5 4" />
              <text x="135" y="4" class="fill-slate-500 text-[10px]">{{ t("aggregation.key.other") }}</text>
            </g>
          </template>
        </template>
      </svg>
      <p class="mt-1.5 text-[11px] leading-snug text-gray-500">
        {{ t(`aggregation.${kind}.note`) }}
      </p>
    </figure>

    <!-- 2. borders -->
    <figure class="m-0">
      <figcaption class="mb-2 text-xs font-semibold text-gray-700">
        <span class="text-heigit-red">2.</span> {{ t("aggregation.borders") }}
      </figcaption>
      <svg :viewBox="`-2 -2 ${COLS * CELL + 4} ${ROWS * CELL + 4}`" class="w-full rounded">
        <template v-if="kind === 'points'">
          <rect :width="COLS * CELL" :height="ROWS * CELL" fill="#f8fafc" />
          <rect
            v-for="cell in cells.filter((c) => hazard !== 'cyclone' && DEPTH[c.r][c.c] > 0)"
            :key="`f-${cell.r}-${cell.c}`"
            :x="cell.c * CELL"
            :y="cell.r * CELL"
            :width="CELL + 0.5"
            :height="CELL + 0.5"
            :fill="FLOODED[cell.r][cell.c] ? zone.fill : '#dbeafe'"
            :opacity="hovered && hovered !== cell.district ? 0.3 : 1"
          />
          <g
            v-if="hazard === 'cyclone'"
            fill="none"
            stroke-linecap="round"
            stroke-linejoin="round"
            :opacity="hovered ? 0.6 : 1"
          >
            <path v-for="(g, i) in SEGMENTS" :key="`e${i}`" :d="g.d" stroke="#8b5cf6" :stroke-width="g.r * 2 + 3" />
            <path v-for="(g, i) in SEGMENTS" :key="`z${i}`" :d="g.d" :stroke="zone.fill" :stroke-width="g.r * 2" />
          </g>
          <line
            v-for="(e, i) in hazard !== 'cyclone' ? floodEdges : []"
            :key="`pe-${i}`"
            v-bind="e"
            stroke="#2563eb"
            stroke-width="2.5"
            stroke-linecap="round"
            :opacity="hovered ? 0.5 : 1"
          />
          <circle
            v-for="(f, i) in facilities"
            :key="i"
            :cx="f.x"
            :cy="f.y"
            r="6"
            :fill="exposed(f) ? '#cc0130' : '#94a3b8'"
            stroke="white"
            stroke-width="1.5"
            class="transition-opacity duration-200"
            :opacity="hovered && hovered !== f.district ? 0.15 : 1"
          />
        </template>
        <template v-else>
          <rect
            v-for="cell in cells"
            :key="`${cell.r}-${cell.c}`"
            :x="cell.c * CELL + 1"
            :y="cell.r * CELL + 1"
            :width="CELL - 2"
            :height="CELL - 2"
            rx="3"
            :fill="cellColor(cell.value, cell.counted, cell.shallow)"
            class="transition-opacity duration-200"
            :opacity="hovered && hovered !== cell.district ? 0.2 : 1"
          />
          <line
            v-for="(e, i) in hazard !== 'cyclone' ? floodEdges : []"
            :key="`fe-${i}`"
            v-bind="e"
            stroke="#2563eb"
            stroke-width="2.5"
            stroke-linecap="round"
            class="pointer-events-none"
            :opacity="hovered ? 0.5 : 1"
          />
          <template v-if="hazard === 'cyclone'">
            <mask :id="`ring-b-${uid}`">
              <g fill="none" stroke-linecap="round">
                <path v-for="(g, i) in SEGMENTS" :key="`w${i}`" :d="g.d" stroke="white" :stroke-width="g.r * 2 + 3" />
                <path v-for="(g, i) in SEGMENTS" :key="`b${i}`" :d="g.d" stroke="black" :stroke-width="g.r * 2" />
              </g>
            </mask>
            <rect :width="COLS * CELL" :height="ROWS * CELL" fill="#7c3aed" :mask="`url(#ring-b-${uid})`" class="pointer-events-none" />
          </template>
        </template>
        <line
          v-for="(s, i) in borders"
          :key="`b-${i}`"
          v-bind="s"
          stroke="#1f2937"
          stroke-width="2.5"
          stroke-linecap="round"
        />
        <text
          v-for="d in DISTRICTS"
          :key="d.id"
          :x="labelPos(d.id).x"
          :y="labelPos(d.id).y + 5"
          text-anchor="middle"
          class="pointer-events-none fill-slate-900 text-[15px] font-black"
          stroke="white"
          stroke-width="3"
          paint-order="stroke"
        >
          {{ d.id }}
        </text>
      </svg>
    </figure>

    <!-- 3. totals -->
    <figure class="m-0">
      <figcaption class="mb-2 text-xs font-semibold text-gray-700">
        <span class="text-heigit-red">3.</span>
        {{ t(`aggregation.${kind}.totals`) }}
      </figcaption>
      <ul class="m-0 flex list-none flex-col gap-2.5 p-0">
        <li
          v-for="t in totals"
          :key="t.id"
          class="cursor-default rounded-md px-2 py-1.5 transition-colors"
          :class="hovered === t.id ? 'bg-red-50' : ''"
          @mouseenter="hovered = t.id"
          @mouseleave="hovered = null"
        >
          <div class="flex items-baseline justify-between text-xs">
            <span class="font-semibold text-gray-700">{{ t.name }}</span>
            <span class="text-base font-black tabular-nums text-gray-900">{{ t.total }}</span>
          </div>
          <div class="mt-1 h-2 rounded-full bg-gray-100">
            <div
              class="h-2 rounded-full bg-heigit-red"
              :style="{ width: `${(t.total / maxTotal) * 100}%` }"
            />
          </div>
        </li>
      </ul>
      <p class="mt-3 text-[11px] leading-snug text-gray-500">
        {{ t(`aggregation.${kind}.hoverHint`) }}
      </p>
    </figure>
  </div>
</template>
