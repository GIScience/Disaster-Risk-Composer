<script setup lang="ts">
import { computed, ref } from "vue";
import { useStoryText } from "@/composables/useStoryText";

/**
 * Cyclone counterpart of StoryDepthProfile: a small scene in the wind. The user sets the wind
 * speed; the 34-knot (63 km/h) threshold marks where the dashboard starts counting places as
 * exposed. The scale below shows where the Saffir-Simpson categories start - those are a storm's
 * peak winds near its centre, far above the threshold at the edge of the wind zone.
 */
const props = withDefaults(defineProps<{ thresholdKmh?: number }>(), { thresholdKmh: 63 });
const { t, list } = useStoryText();

const W = 640;
const H = 250;
const GROUND = 225;
const MAX_KMH = 260;

const speed = ref(80);
const counts = computed(() => speed.value >= props.thresholdKmh);
const knots = computed(() => Math.round(speed.value / 1.852));
const strength = computed(() => Math.min(speed.value / 200, 1)); // 0..1 for the scene

// What the wind does at this speed (Beaufort scale, simplified). The texts are the list
// `wind.effects` in text.md, one per speed band: below 20, 50, 62, 89, 118 km/h, and above.
const EFFECT_BANDS_KMH = [20, 50, 62, 89, 118];
const effect = computed(() => {
  const band = EFFECT_BANDS_KMH.findIndex((max) => speed.value < max);
  return list("wind.effects")[band === -1 ? EFFECT_BANDS_KMH.length : band] ?? "";
});

// Scene: the tree bends and the person leans into the wind (skew around their base)
const treeSkew = computed(() => -strength.value * 32);
const personSkew = computed(() => strength.value * 14);
// Roof tiles come off from about 90 km/h and fly further the stronger the wind
const tileLift = computed(() => Math.max(0, (speed.value - 89) / (MAX_KMH - 89)));
const TILES = [
  { x: 96, y: 118 },
  { x: 116, y: 104 },
  { x: 136, y: 104 },
  { x: 156, y: 118 },
];

// Wind streaks: more, longer and faster with stronger wind
const STREAKS = [
  { y: 40, delay: 0 },
  { y: 70, delay: 0.5 },
  { y: 100, delay: 0.2 },
  { y: 130, delay: 0.8 },
  { y: 160, delay: 0.35 },
  { y: 190, delay: 0.65 },
  { y: 55, delay: 1.0 },
  { y: 145, delay: 1.2 },
];
const streaks = computed(() => {
  const n = Math.round(1 + strength.value * (STREAKS.length - 1));
  const duration = 2.6 - strength.value * 1.9;
  return STREAKS.slice(0, n).map((s, i) => ({
    ...s,
    x: 20 + ((i * 97) % 300),
    len: 30 + strength.value * 70,
    duration,
  }));
});

// Leaves flying past once the wind reaches the threshold
const LEAVES = [
  { y: 80, delay: 0.1 },
  { y: 120, delay: 0.7 },
  { y: 60, delay: 1.3 },
  { y: 150, delay: 0.4 },
];

// Speed scale below the scene
const SCALE_X0 = 20;
const SCALE_X1 = W - 20;
const xOf = (kmh: number) => SCALE_X0 + (kmh / MAX_KMH) * (SCALE_X1 - SCALE_X0);
// Where the Saffir-Simpson categories start (1-minute sustained wind)
const CATEGORIES = computed(() =>
  [
    { n: 1, kmh: 119 },
    { n: 2, kmh: 154 },
    { n: 3, kmh: 178 },
    { n: 4, kmh: 209 },
    { n: 5, kmh: 252 },
  ].map((c) => ({ ...c, label: t("wind.category", { n: c.n }) })),
);
</script>

<template>
  <div class="w-full">
    <!-- Status -->
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div class="text-sm text-gray-700">
        {{ t("wind.speed") }}:
        <span class="text-lg font-black tabular-nums text-gray-900">{{ speed }} km/h</span>
        <span class="ml-1 text-xs tabular-nums text-gray-500">({{ knots }} kt)</span>
      </div>
      <span
        class="rounded-full px-3 py-1 text-xs font-bold"
        :class="counts ? 'bg-heigit-red text-white' : 'bg-gray-200 text-gray-600'"
      >
        {{ counts ? t("wind.counts") : t("wind.notCounted") }}
      </span>
    </div>

    <svg
      :viewBox="`0 0 ${W} ${H}`"
      class="w-full"
      role="img"
      aria-label="A house, a tree and a person in wind of the chosen speed"
    >
      <!-- wind streaks (blowing from left to right) -->
      <g stroke="#8b5cf6" stroke-linecap="round" fill="none">
        <path
          v-for="(s, i) in streaks"
          :key="`s-${i}`"
          class="wind-streak"
          :d="`M${s.x} ${s.y} q ${s.len / 2} -6 ${s.len} 0`"
          stroke-width="2.5"
          :style="{ animationDuration: `${s.duration}s`, animationDelay: `${s.delay}s` }"
        />
      </g>

      <!-- house; its roof tiles come off in strong wind -->
      <g fill="#334155">
        <rect x="80" y="130" width="100" height="95" />
        <path d="M70 134 L130 88 L190 134 Z" />
        <rect x="118" y="180" width="24" height="45" fill="#e2e8f0" />
        <rect x="92" y="150" width="18" height="18" fill="#e2e8f0" />
        <rect x="150" y="150" width="18" height="18" fill="#e2e8f0" />
      </g>
      <rect
        v-for="(t, i) in TILES"
        :key="`t-${i}`"
        :x="t.x"
        :y="t.y"
        width="16"
        height="6"
        rx="1"
        fill="#64748b"
        class="transition-transform duration-500"
        :style="{
          transformBox: 'fill-box',
          transformOrigin: 'center',
          transform: `translate(${tileLift * (160 + i * 60)}px, ${-tileLift * (40 + i * 18)}px) rotate(${tileLift * (120 + i * 70)}deg)`,
        }"
        :opacity="1 - tileLift * 0.4"
      />

      <!-- tree, bending with the wind -->
      <g
        class="transition-transform duration-500"
        :style="{ transformOrigin: '320px 225px', transform: `skewX(${treeSkew}deg)` }"
      >
        <path d="M314 225 L317 120 L323 120 L326 225 Z" fill="#334155" />
        <circle cx="320" cy="105" r="34" fill="#65a30d" />
        <circle cx="296" cy="122" r="22" fill="#65a30d" />
        <circle cx="344" cy="122" r="22" fill="#65a30d" />
      </g>

      <!-- person leaning into the wind (same pictogram as in the flood story map) -->
      <g
        class="transition-transform duration-500"
        :style="{ transformOrigin: '500px 225px', transform: `skewX(${personSkew}deg)` }"
      >
        <g :transform="`translate(500 ${GROUND}) scale(${115 / 182}) translate(-50 -182)`" fill="#334155">
          <path d="M30 56 L64 56 L82 121 Q83 126 77 126 L30 126 Z" />
          <rect x="30" y="120" width="17" height="62" rx="8" />
          <rect x="51" y="120" width="13" height="62" rx="6.5" />
          <circle cx="49" cy="20" r="14.5" />
          <path d="M15 54 Q15 38 31 38 L60 38 Q71 38 76 47 L91 91 Q93 100 84 100 Q79 100 77 94 L66 59 L27 59 L27 54 Z" />
          <rect x="15" y="46" width="12" height="62" rx="6" />
        </g>
      </g>

      <!-- leaves and debris once the wind counts -->
      <g v-if="counts" fill="#65a30d">
        <ellipse
          v-for="(l, i) in LEAVES"
          :key="`l-${i}`"
          class="wind-leaf"
          cx="250"
          :cy="l.y"
          rx="5"
          ry="2.5"
          :style="{ animationDuration: `${2.4 - strength * 1.4}s`, animationDelay: `${l.delay}s` }"
        />
      </g>

      <!-- ground -->
      <rect x="0" :y="GROUND" :width="W" :height="H - GROUND" fill="#e7e1d8" />
      <line x1="0" :x2="W" :y1="GROUND" :y2="GROUND" stroke="#a8a29e" stroke-width="2" />
    </svg>

    <p class="mt-2 min-h-[2.5rem] text-sm leading-snug text-gray-700">{{ effect }}</p>

    <!-- speed scale: threshold and where the storm categories start -->
    <svg :viewBox="`0 0 ${W} 62`" class="mt-1 w-full" aria-hidden="true">
      <rect :x="SCALE_X0" y="22" :width="SCALE_X1 - SCALE_X0" height="10" rx="5" fill="#ede9fe" />
      <rect
        :x="SCALE_X0"
        y="22"
        :width="Math.max(xOf(speed) - SCALE_X0, 10)"
        height="10"
        rx="5"
        fill="#7c3aed"
        class="transition-all duration-300"
      />
      <g v-for="c in CATEGORIES" :key="c.label">
        <line :x1="xOf(c.kmh)" :x2="xOf(c.kmh)" y1="20" y2="36" stroke="#94a3b8" stroke-width="1.5" />
        <text :x="xOf(c.kmh)" y="50" text-anchor="middle" class="fill-slate-400 text-[11px]">{{ c.label }}</text>
      </g>
      <line
        :x1="xOf(props.thresholdKmh)"
        :x2="xOf(props.thresholdKmh)"
        y1="14"
        y2="40"
        stroke="#cc0130"
        stroke-width="2"
        stroke-dasharray="4 3"
      />
      <text :x="xOf(props.thresholdKmh)" y="10" text-anchor="middle" class="fill-[#cc0130] text-[12px] font-bold">
        {{ t("wind.threshold") }}
      </text>
      <text :x="xOf(props.thresholdKmh)" y="50" text-anchor="middle" class="fill-[#cc0130] text-[11px]">
        {{ props.thresholdKmh }} km/h
      </text>
    </svg>
    <p class="mt-1 text-[11px] leading-snug text-gray-500">
      {{ t("wind.scaleNote") }}
    </p>

    <!-- Wind speed control -->
    <label class="mt-4 block text-xs font-medium text-gray-600">
      {{ t("wind.setSpeed") }}
      <input
        v-model.number="speed"
        type="range"
        min="0"
        :max="MAX_KMH"
        step="1"
        class="mt-2 w-full cursor-pointer accent-heigit-red"
        aria-label="Wind speed in km/h"
      />
    </label>
    <div class="mt-1 flex flex-wrap gap-1.5">
      <button
        v-for="kmh in [40, 63, 90, 120, 200]"
        :key="kmh"
        type="button"
        class="rounded-md border border-solid px-2.5 py-1 text-xs font-semibold transition-colors"
        :class="
          speed === kmh
            ? 'border-heigit-red bg-heigit-red text-white'
            : 'border-gray-300 bg-white text-gray-600 hover:border-heigit-red'
        "
        @click="speed = kmh"
      >
        {{ kmh }} km/h
      </button>
    </div>
  </div>
</template>

<style scoped>
.wind-streak {
  animation-name: gust;
  animation-iteration-count: infinite;
  animation-timing-function: linear;
  opacity: 0;
}
@keyframes gust {
  0% {
    transform: translateX(0);
    opacity: 0;
  }
  20% {
    opacity: 0.8;
  }
  100% {
    transform: translateX(320px);
    opacity: 0;
  }
}
.wind-leaf {
  transform-box: fill-box;
  transform-origin: center;
  animation-name: leaf;
  animation-iteration-count: infinite;
  animation-timing-function: ease-in;
  opacity: 0;
}
@keyframes leaf {
  0% {
    transform: translate(0, 0) rotate(0deg);
    opacity: 0;
  }
  15% {
    opacity: 1;
  }
  100% {
    transform: translate(380px, 30px) rotate(540deg);
    opacity: 0;
  }
}
@media (prefers-reduced-motion: reduce) {
  .wind-streak,
  .wind-leaf {
    animation: none;
    opacity: 0.6;
  }
}
</style>
