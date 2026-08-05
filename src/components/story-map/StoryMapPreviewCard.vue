<script setup lang="ts">
const props = defineProps<{
  storyMap: {
    id: string;
    image: string;
    alt: string;
    title: string;
    summary: string;
  };
}>();

const imageSrc = `${import.meta.env.BASE_URL}${props.storyMap.image.replace(/^\//, "")}`;
</script>

<template>
  <RouterLink
    :to="`/story-map/${storyMap.id}`"
    class="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-heigit-50 shadow-sm transition-all hover:border-heigit-red hover:scale-105"
  >
    <img :src="imageSrc" :alt="storyMap.alt" class="h-44 w-full object-cover" />
    <div class="flex flex-1 flex-col p-5">
      <h2
        class="font-bold text-slate-900 transition-colors group-hover:text-heigit-red"
      >
        {{ storyMap.title }}
      </h2>
      <p class="mt-2 line-clamp-3 text-sm text-slate-600">
        {{ storyMap.summary }}
      </p>
    </div>
  </RouterLink>
</template>
