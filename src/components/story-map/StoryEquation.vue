<script setup lang="ts">
import type { EquationTerm } from "@/types/story-map";
defineProps<{ terms: EquationTerm[]; compact?: boolean }>();
</script>

<template>
  <div
    class="flex flex-wrap items-center justify-center"
    :class="compact ? 'gap-x-3 gap-y-1' : 'gap-x-6 gap-y-4'"
  >
    <template v-for="(term, i) in terms" :key="i">
      <div
        v-if="term.kind === 'operator'"
        class="font-light text-gray-400"
        :class="compact ? 'text-base' : 'text-2xl'"
      >
        {{ term.symbol }}
      </div>
      <figure
        v-else
        class="flex flex-col items-center text-center"
        :class="compact ? 'w-24' : 'w-40'"
      >
        <v-icon
          v-if="term.icon"
          :icon="term.icon"
          :class="compact ? 'h-6 w-6' : 'h-14 w-14'"
          class="text-gray-500"
        />
        <img
          v-else-if="term.image"
          :src="term.image"
          :alt="term.alt"
          class="h-14 w-auto object-contain"
        />
        <figcaption
          class="font-semibold text-gray-800"
          :class="compact ? 'mt-1 text-xs' : 'mt-2 text-sm'"
        >
          {{ term.label }}
        </figcaption>
        <span v-if="term.sublabel" class="text-xs text-gray-500">{{ term.sublabel }}</span>
      </figure>
    </template>
  </div>
</template>