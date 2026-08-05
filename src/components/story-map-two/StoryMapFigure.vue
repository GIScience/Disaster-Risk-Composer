<script setup lang="ts">
import type { Figure } from "@/types/story-map";
const props = defineProps<{
  figure: Figure;
}>();

const source = props.figure.source;
const imageSrc1 = `${import.meta.env.BASE_URL}${source.replace(/^\//, "")}`;
</script>

<template>
  <div class="flex h-[34rem] items-center justify-center bg-[#f3f4f2]">
    <img
      :src="imageSrc1"
      :alt="figure.alt"
      class="mx-auto h-96 w-full max-w-full object-contain"
    />
  </div>
</template>
