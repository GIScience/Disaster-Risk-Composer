<script setup lang="ts">
import PageLayout from "@/layout/PageLayout.vue";
import type { StoryMapConfig } from "@/types/story-map";
import StoryMapPreviewCard from "@/components/story-map/StoryMapPreviewCard.vue";

const modules = import.meta.glob<{ default: StoryMapConfig }>(
  "@/content/story-maps/*.json",
  {
    eager: true,
  },
);

const storyMaps = Object.entries(modules)
  .map(([path, mod]) => {
    const id = path.split("/").pop()!.replace(".json", "");
    const hero = mod.default.storyMap.hero;
    return {
      id,
      image: hero.image,
      alt: hero.alt,
      title: hero.title,
      summary: hero.subtitle,
    };
  })
  .sort((a, b) => a.title.localeCompare(b.title));


</script>

<template>
  <PageLayout title="Story Maps">
    <div
      class="relative overflow-hidden"
    >

      <div
        class="mx-auto max-w-3xl px-4 text-center flex flex-col justify-center sm:px-6 sm:py-20 min-h-screen lg:px-8"
      >
        <h1
          class="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl"
        >
          See how humanitarian risk
          <span class="text-heigit-red">come to life</span>
        </h1>
        <p class="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
          Interactive walkthroughs of how HeiGIT quantifies humanitarian risk.
          Explore the data, the methodology, and the result.
        </p>
      </div>
    </div>

    <div class="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
      <ul
        class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 list-none"
      >
        <li
          v-for="(storyMap, index) in storyMaps"
          :key="storyMap.id"
          class="animate-[fade-in_0.5s_ease-out_both]"
          :style="{ animationDelay: `${index * 60}ms` }"
        >
          <StoryMapPreviewCard :storyMap="storyMap" />
        </li>
      </ul>
    </div>
  </PageLayout>
</template>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
