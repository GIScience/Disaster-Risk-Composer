<script setup lang="ts">
import type { Figure } from "@/types/story-map";
const props = defineProps<{
  figure: Figure;
}>();

const source = props.figure.source;
const imageSrc1 = `${import.meta.env.BASE_URL}${source.replace(/^\//, "")}`;
</script>

<template>
  <div class="flex items-center justify-center w-full">
    <img
      :src="imageSrc1"
      :alt="figure.alt"
      width="100%"
      height="100%"
      class="mx-auto h-96 w-full max-w-full object-contain"
    />
  </div>
</template>
