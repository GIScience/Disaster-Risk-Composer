<script setup lang="ts">
import { computed, onMounted, ref } from "vue";

/**
 * How the dashboard turns district counts into map colours, with the real districts of the
 * example country: every dot is a district placed by its count; the same axis read as 0-1 is the
 * score (lowest district = 0, highest = 1); the background bands are the quartiles that set the
 * four map colours. Hovering a dot shows the district.
 */
const props = defineProps<{ valuesUrl: string; unitLabel?: string }>();

type Row = { name: string; value: number };
const rows = ref<Row[]>([]);
onMounted(async () => {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}${props.valuesUrl.replace(/^\//, "")}`);
    rows.value = await res.json();
  } catch {
    rows.value = [];
  }
});

const W = 600;
const H = 230;
const LEFT = 56; // count axis
const RIGHT = 40; // score axis
const TOP = 26;
const BOTTOM = 190;
const plotW = W - LEFT - RIGHT;
const plotH = BOTTOM - TOP;

// Same colours and quartile rule as the dashboard map (useRiskLogic.updateRiskLayer)
const CLASSES = [
  { label: "Low", color: "#ffffff" },
  { label: "Moderate", color: "#f9d5b6" },
  { label: "High", color: "#f6a44d" },
  { label: "Very high", color: "#cc0130" },
];

const sorted = computed(() => [...rows.value].sort((a, b) => a.value - b.value));

const stats = computed(() => {
  const values = sorted.value.map((r) => r.value);
  if (!values.length) return null;
  const q = (p: number) => values[Math.floor(values.length * p)];
  return { min: values[0], max: values[values.length - 1], q1: q(0.25), q2: q(0.5), q3: q(0.75) };
});

const score = (v: number) => {
  const s = stats.value;
  return s && s.max > s.min ? (v - s.min) / (s.max - s.min) : 0;
};
const classOf = (v: number) => {
  const s = stats.value!;
  return v > s.q3 ? 3 : v > s.q2 ? 2 : v > s.q1 ? 1 : 0;
};

// One bar per district, sorted from lowest to highest. Bar height = count = score (same scale).
const bars = computed(() => {
  if (!stats.value) return [];
  const n = sorted.value.length;
  const slot = plotW / n;
  return sorted.value.map((r, i) => {
    const h = Math.max(score(r.value) * plotH, 1.5);
    return {
      ...r,
      x: LEFT + i * slot + slot * 0.12,
      w: slot * 0.76,
      y: BOTTOM - h,
      h,
      cls: classOf(r.value),
      score: score(r.value),
    };
  });
});

// Labels for the four groups of districts under the bars
const groups = computed(() =>
  CLASSES.map((c, k) => {
    const own = bars.value.filter((b) => b.cls === k);
    if (!own.length) return null;
    const x1 = own[0].x;
    const x2 = own[own.length - 1].x + own[own.length - 1].w;
    return { ...c, x1, x2, count: own.length };
  }).filter((g): g is NonNullable<typeof g> => !!g),
);

const countTicks = computed(() => {
  const s = stats.value;
  if (!s) return [];
  const raw = s.max / 4;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = Math.ceil(raw / mag) * mag;
  const ticks = [];
  for (let v = 0; v <= s.max; v += step) ticks.push(v);
  return ticks.map((v) => ({ v, y: BOTTOM - score(v) * plotH }));
});

const hovered = ref<(typeof bars.value)[number] | null>(null);
const fmt = (v: number) => v.toLocaleString("en");
</script>

<template>
  <div class="w-full">
    <svg
      v-if="stats"
      :viewBox="`0 0 ${W} ${H}`"
      class="w-full overflow-visible"
      role="img"
      aria-label="Districts sorted by count, with score scale and quartile colours"
    >
      <!-- grid + count axis (left) -->
      <g v-for="t in countTicks" :key="t.v">
        <line :x1="LEFT" :x2="LEFT + plotW" :y1="t.y" :y2="t.y" stroke="#e5e7eb" />
        <text :x="LEFT - 6" :y="t.y + 4" text-anchor="end" class="fill-slate-500 text-[10px]">
          {{ fmt(t.v) }}
        </text>
      </g>
      <!-- score axis (right): the same bars read as 0-1 -->
      <g v-for="s in [0, 0.5, 1]" :key="s">
        <text
          :x="LEFT + plotW + 6"
          :y="BOTTOM - s * plotH + 4"
          class="fill-[#cc0130] text-[11px] font-bold"
        >
          {{ s }}
        </text>
      </g>
      <text :x="LEFT + plotW + 6" :y="TOP - 12" class="fill-[#cc0130] text-[10px]">score</text>

      <!-- bars -->
      <rect
        v-for="b in bars"
        :key="b.name"
        :x="b.x"
        :y="b.y"
        :width="b.w"
        :height="b.h"
        :fill="CLASSES[b.cls].color"
        :stroke="b.cls === 0 ? '#94a3b8' : 'none'"
        stroke-width="0.6"
        class="cursor-pointer"
        :opacity="hovered && hovered.name !== b.name ? 0.55 : 1"
        @mouseenter="hovered = b"
        @mouseleave="hovered = null"
      />
      <line :x1="LEFT" :x2="LEFT + plotW" :y1="BOTTOM" :y2="BOTTOM" stroke="#334155" stroke-width="1.5" />

      <!-- quartile groups -->
      <g v-for="g in groups" :key="g.label">
        <line :x1="g.x1" :x2="g.x2" :y1="BOTTOM + 8" :y2="BOTTOM + 8" stroke="#94a3b8" stroke-width="1.5" />
        <text :x="(g.x1 + g.x2) / 2" :y="BOTTOM + 22" text-anchor="middle" class="fill-slate-700 text-[11px] font-semibold">
          {{ g.label }}
        </text>
        <text :x="(g.x1 + g.x2) / 2" :y="BOTTOM + 35" text-anchor="middle" class="fill-slate-400 text-[10px]">
          {{ g.count }} districts
        </text>
      </g>

      <!-- tooltip -->
      <g
        v-if="hovered"
        :transform="`translate(${Math.min(Math.max(hovered.x, LEFT + 90), W - RIGHT - 90)} ${Math.max(hovered.y - 10, TOP + 44)})`"
      >
        <rect x="-90" y="-40" width="180" height="34" rx="6" fill="#0f172a" />
        <text x="0" y="-26" text-anchor="middle" class="fill-white text-[11px] font-bold">{{ hovered.name }}</text>
        <text x="0" y="-12" text-anchor="middle" class="fill-slate-300 text-[10px]">
          {{ fmt(hovered.value) }} · score {{ hovered.score.toFixed(2) }} · {{ CLASSES[hovered.cls].label }}
        </text>
      </g>
    </svg>

    <p class="mt-2 text-xs text-gray-500">
      {{ unitLabel ?? "Count" }}, one bar per district, sorted. The colour groups are split at the
      quartiles, so each holds about a quarter of the districts; districts with the same value stay
      in the same group. Hover a bar to see the district.
    </p>
  </div>
</template>
