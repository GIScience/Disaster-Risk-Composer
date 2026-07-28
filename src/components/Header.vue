<script setup lang="ts">
import { computed } from "vue";
import { RouterLink, useRouter, useRoute } from "vue-router";
import { storeToRefs } from "pinia";
import logo from "@/assets/risk-assessment-lens-logo.png";
import { useRiskMapStore } from "@/store/riskMapStore";

const props = withDefaults(
  defineProps<{
    title?: string;
    subtitle?: string;
    homeLink?: string;
  }>(),
  {
    title: "Hazard Risk Dashboard",
    subtitle: "Visualizing risk potential of natural hazards",
    homeLink: "/",
  },
);

const route = useRoute();
const router = useRouter();

const { selectedCountry, selectedDisaster, riskViewMode } =
  storeToRefs(useRiskMapStore());

const homeTarget = computed(() => {
  if (props.homeLink !== "/" || !selectedCountry.value) return props.homeLink;

  const query: Record<string, string> = { country: selectedCountry.value };
  if (selectedDisaster.value) query.disaster = selectedDisaster.value;
  if (riskViewMode.value) query.dimension = riskViewMode.value;
  return { path: "/", query };
});
</script>

<template>
  <header
    class="w-full sticky top-0 bg-white border-b border-slate-200 shadow-sm z-[100]"
  >
    <div class="px-6 py-3 flex items-center justify-between gap-4 mx-auto">
      <RouterLink
        :to="homeTarget"
        class="flex items-center gap-3 min-w-0 group shrink-0"
      >
        <img :src="logo" alt="" class="h-9 w-9 object-contain shrink-0" />
        <div class="flex flex-col items-start leading-tight text-left min-w-0">
          <span
            class="font-extrabold text-slate-900 tracking-tight text-lg truncate group-hover:text-heigit-red transition-colors"
          >
            {{ title }}
          </span>
          <span
            v-if="subtitle"
            class="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 truncate"
          >
            {{ subtitle }}
          </span>
        </div>
      </RouterLink>
      <slot name="actions">
        <button
          @click="router.push('/')"
          class="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest text-slate-400 transition-colors hover:text-heigit-red border hover:border-heigit-red border-slate-200 rounded-md px-3 py-2 hover:bg-slate-50"
        >
          <svg
            class="h-3.5 w-3.5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M15 19l-7-7 7-7"
            />
          </svg>
          Back to Dashboard
        </button>
      </slot>
    </div>
  </header>
</template>
