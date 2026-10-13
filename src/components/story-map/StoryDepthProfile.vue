<script setup lang="ts">
import { computed, ref } from "vue";

/**
 * People of every group in the data standing side by side in flood water. The user sets the
 * water depth; the 30 cm line marks where the dashboard starts counting people as exposed, and
 * the slider moves the water level.
 */
const props = withDefaults(defineProps<{ threshold?: number }>(), { threshold: 30 });

const W = 640;
const H = 275;
const GROUND = 250; // ground line (y)
const PX_PER_M = 115;
const MAX_CM = 150;

// Gender-neutral pictograms derived from one base icon (100 × 186 units, feet at y = 182):
// "adult" is the base icon, "child" the same shape with child proportions (larger head),
// "senior" slightly bent forward with a walking stick.
type Kind = "child" | "adult" | "senior";
const PEOPLE: { label: string; heightM: number; kind: Kind }[] = [
  { label: "Child", heightM: 1.0, kind: "child" },
  { label: "Adult", heightM: 1.7, kind: "adult" },
  { label: "Older person", heightM: 1.6, kind: "senior" },
];
const ICON_H = 182; // icon units from top of head to feet

const depthCm = ref(40);
const counts = computed(() => depthCm.value >= props.threshold);
const waterY = computed(() => GROUND - (depthCm.value / 100) * PX_PER_M);
const thresholdY = GROUND - (props.threshold / 100) * PX_PER_M;

// Left margin holds the height scale and the threshold label, so they never overlap people.
const MARGIN = 140;
const slotW = (W - MARGIN - 10) / PEOPLE.length;
const ticks = [50, 100, 150].map((cm) => ({ cm, y: GROUND - (cm / 100) * PX_PER_M }));

const people = computed(() =>
  PEOPLE.map((p, i) => ({
    ...p,
    cx: MARGIN + slotW * (i + 0.5),
    h: p.heightM * PX_PER_M,
  })),
);
</script>

<template>
  <div class="w-full">
    <!-- Status -->
    <div class="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div class="text-sm text-gray-700">
        Water depth:
        <span class="text-lg font-black tabular-nums text-gray-900">{{ depthCm }} cm</span>
      </div>
      <span
        class="rounded-full px-3 py-1 text-xs font-bold"
        :class="counts ? 'bg-heigit-red text-white' : 'bg-gray-200 text-gray-600'"
      >
        {{ counts ? "Counts as exposed" : `Not counted (below ${props.threshold} cm)` }}
      </span>
    </div>

    <svg
      :viewBox="`0 0 ${W} ${H}`"
      class="w-full"
      role="img"
      aria-label="People of different groups standing in flood water"
    >
      <!-- people (drawn behind the water, so the water covers them) -->
      <g
        v-for="p in people"
        :key="p.label"
        :transform="`translate(${p.cx} ${GROUND}) scale(${p.h / ICON_H}) translate(-50 -${ICON_H})`"
        fill="#334155"
      >
        <!-- torso with the half skirt; its diagonal edge runs parallel to the angled arm -->
        <path d="M30 56 L64 56 L82 121 Q83 126 77 126 L30 126 Z" />
        <!-- legs -->
        <rect x="30" y="120" width="17" height="62" rx="8" />
        <rect x="51" y="120" width="13" height="62" rx="6.5" />
        <!-- head, as in the original icon -->
        <circle cx="49" cy="20" r="14.5" />
        <!-- shoulders flowing into the angled arm, like the original icon;
             the older person's arm reaches further out to hold the walking stick -->
        <path
          v-if="p.kind === 'senior'"
          d="M15 54 Q15 38 31 38 L60 38 Q71 38 76 47 L99 88 Q103 96 96 99 Q91 101 88 96 L66 59 L27 59 L27 54 Z"
        />
        <path
          v-else
          d="M15 54 Q15 38 31 38 L60 38 Q71 38 76 47 L91 91 Q93 100 84 100 Q79 100 77 94 L66 59 L27 59 L27 54 Z"
        />
        <!-- straight arm -->
        <rect x="15" y="46" width="12" height="62" rx="6" />
        <!-- walking stick with a crook handle in the hand -->
        <g v-if="p.kind === 'senior'" fill="none" stroke="#334155" stroke-width="6" stroke-linecap="round">
          <path d="M90 92 Q90 82 98 82 Q106 82 106 92" />
          <line x1="106" y1="92" x2="106" y2="182" />
        </g>
      </g>

      <!-- flood water -->
      <rect
        :x="MARGIN - 30"
        :y="waterY"
        :width="W - MARGIN + 30"
        :height="GROUND - waterY"
        fill="#3b82f6"
        fill-opacity="0.55"
        class="transition-all duration-300"
      />
      <line :x1="MARGIN - 30" :x2="W" :y1="waterY" :y2="waterY" stroke="#1d4ed8" stroke-width="2" class="transition-all duration-300" />

      <!-- ground -->
      <rect x="0" :y="GROUND" :width="W" :height="H - GROUND" fill="#e7e1d8" />
      <line :x1="0" :x2="W" :y1="GROUND" :y2="GROUND" stroke="#a8a29e" stroke-width="2" />

      <!-- height scale -->
      <g v-for="t in ticks" :key="t.cm">
        <line :x1="MARGIN - 34" :x2="MARGIN - 26" :y1="t.y" :y2="t.y" stroke="#94a3b8" stroke-width="1.5" />
        <text :x="MARGIN - 38" :y="t.y + 4" text-anchor="end" class="fill-slate-400 text-[13px]">{{ t.cm }} cm</text>
      </g>
      <line :x1="MARGIN - 30" :x2="MARGIN - 30" :y1="ticks[2].y" :y2="GROUND" stroke="#cbd5e1" stroke-width="1.5" />

      <!-- threshold -->
      <line :x1="MARGIN - 30" :x2="W" :y1="thresholdY" :y2="thresholdY" stroke="#cc0130" stroke-width="2" stroke-dasharray="6 4" />
      <text :x="MARGIN - 38" :y="thresholdY - 2" text-anchor="end" class="fill-[#cc0130] text-[15px] font-bold">
        {{ props.threshold }} cm
      </text>
      <text :x="MARGIN - 38" :y="thresholdY + 12" text-anchor="end" class="fill-[#cc0130] text-[12px]">
        threshold
      </text>

      <!-- group labels -->
      <g v-for="p in people" :key="`l-${p.label}`">
        <text :x="p.cx" :y="GROUND + 19" text-anchor="middle" class="fill-slate-700 text-[14px] font-semibold">
          {{ p.label }}
        </text>
      </g>
    </svg>

    <!-- Water level control -->
    <label class="mt-4 block text-xs font-medium text-gray-600">
      Set the flood depth
      <input
        v-model.number="depthCm"
        type="range"
        min="0"
        :max="MAX_CM"
        step="5"
        class="mt-2 w-full cursor-pointer accent-heigit-red"
        aria-label="Flood depth in centimetres"
      />
    </label>
    <div class="mt-1 flex flex-wrap gap-1.5">
      <button
        v-for="cm in [10, 30, 50, 100, 150]"
        :key="cm"
        type="button"
        class="rounded-md border border-solid px-2.5 py-1 text-xs font-semibold transition-colors"
        :class="
          depthCm === cm
            ? 'border-heigit-red bg-heigit-red text-white'
            : 'border-gray-300 bg-white text-gray-600 hover:border-heigit-red'
        "
        @click="depthCm = cm"
      >
        {{ cm }} cm
      </button>
    </div>
  </div>
</template>
