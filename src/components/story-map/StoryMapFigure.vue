<script setup lang="ts">
import { computed } from "vue";
import type { Figure } from "@/types/story-map";
const props = defineProps<{
  figure: Figure;
}>();

const imageSrc1 = computed(
  () => `${import.meta.env.BASE_URL}${props.figure.source.replace(/^\//, "")}`,
);
</script>

<template>
  <div class="flex items-center justify-center w-full">
    <img
      :src="imageSrc1"
      :alt="figure.alt"
      width="100%"
      height="100%"
      class="mx-auto h-60 w-full max-w-full object-contain"
    />
  </div>
</template>
