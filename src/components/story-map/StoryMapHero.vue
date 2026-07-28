<script lang="ts" setup>
import { computed } from "vue";

const DEFAULT_TITLE = "Story Map";
const DEFAULT_SUBTITLE =
  "An interactive walkthrough of how HeiGIT quantifies humanitarian risk.";

const props = defineProps<{
  title: string;
  subtitle: string;
  image: string;
}>();

const title = computed(() => props.title ?? DEFAULT_TITLE);
const subtitle = computed(() => props.subtitle ?? DEFAULT_SUBTITLE);

const imageSrc = `${import.meta.env.BASE_URL}${props.image.replace(/^\//, "")}`;
</script>

<template>
  <section
    class="relative flex h-[calc(100vh-7rem)] w-full items-center justify-center bg-slate-900 overflow-hidden"
  >
    <div
      class="absolute inset-0 z-10 flex flex-col items-center justify-center text-center text-white"
    >
      <h1 class="mb-4 text-2xl font-bold sm:text-3xl md:text-4xl text-white">
        {{ title }}
      </h1>
      <p class="max-w-3xl text-sm sm:text-base md:text-base text-white">
        {{ subtitle }}
      </p>
    </div>
    <img
      :src="imageSrc"
      alt="Story Map Hero"
      class="absolute inset-0 h-full w-full object-cover opacity-50"
    />
  </section>
</template>
