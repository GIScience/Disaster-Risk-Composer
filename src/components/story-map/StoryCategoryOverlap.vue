<script setup lang="ts">
/**
 * How the cyclone classes are made: the 34-knot zones of two storms overlap; where they do, the
 * stronger storm wins, so every place ends up in exactly one class. Colours match the category
 * map (light = weaker class, dark = strongest class).
 */
import RichText from "./RichText.vue";
import { useStoryText } from "@/composables/useStoryText";

defineProps<{ caption?: string }>();
const { t } = useStoryText();

const LIGHT = "#bcbddc";
const DARK = "#3f007d";
</script>

<template>
  <figure class="m-0 rounded-lg border border-solid border-gray-200 bg-white p-3">
    <svg viewBox="0 0 330 138" class="w-full" role="img" aria-label="Two overlapping storm zones; the overlap takes the stronger storm's class">
      <!-- 1. the zones of two storms, overlapping -->
      <text x="72" y="13" text-anchor="middle" class="fill-slate-700 text-[11px] font-semibold">{{ t("overlap.before") }}</text>
      <circle cx="52" cy="66" r="36" :fill="LIGHT" fill-opacity="0.75" stroke="#8b5cf6" stroke-width="1.5" />
      <circle cx="96" cy="66" r="42" :fill="DARK" fill-opacity="0.45" stroke="#8b5cf6" stroke-width="1.5" />
      <text x="34" y="124" text-anchor="middle" class="fill-slate-500 text-[10px]">{{ t("overlap.weakStorm") }}</text>
      <text x="108" y="124" text-anchor="middle" class="fill-slate-500 text-[10px]">{{ t("overlap.strongStorm") }}</text>

      <!-- arrow -->
      <path d="M152 66 H174 M168 60 L174 66 L168 72" fill="none" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" />

      <!-- 2. one class per place: the stronger storm is drawn last and covers the overlap -->
      <text x="256" y="13" text-anchor="middle" class="fill-slate-700 text-[11px] font-semibold">{{ t("overlap.after") }}</text>
      <circle cx="236" cy="66" r="36" :fill="LIGHT" />
      <circle cx="280" cy="66" r="42" :fill="DARK" />
      <text x="218" y="124" text-anchor="middle" class="fill-slate-700 text-[10px] font-semibold">{{ t("overlap.weakClass") }}</text>
      <text x="292" y="124" text-anchor="middle" class="fill-slate-700 text-[10px] font-semibold">{{ t("overlap.strongClass") }}</text>
    </svg>
    <figcaption v-if="caption" class="mt-2 text-xs leading-snug text-gray-600 [&_p]:m-0">
      <RichText :text="caption" />
    </figcaption>
  </figure>
</template>
