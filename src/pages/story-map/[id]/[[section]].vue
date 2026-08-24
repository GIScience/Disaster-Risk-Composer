<script setup lang="ts">
import { computed, ref, watchEffect } from "vue";
import { useRoute, useRouter } from "vue-router";
import PageLayout from "@/layout/PageLayout.vue";
import StoryMap from "@/components/story-map/StoryMap.vue";
import type { StoryMapConfig } from "@/types/story-map";

const route = useRoute();
const router = useRouter();

const modules = import.meta.glob<{ default: StoryMapConfig }>(
  "@/content/story-maps/*.json",
  {
    eager: true,
  },
);

const configsById: Record<string, StoryMapConfig> = {};
for (const path in modules) {
  const id = path.split("/").pop()!.replace(".json", "");
  configsById[id] = modules[path].default;
}

const config = ref<StoryMapConfig | null>(null);

watchEffect(() => {
  const id = route.params.id as string;
  const match = configsById[id];

  if (match) {
    config.value = match;
  } else {
    router.replace({ path: "/404" });
  }
});

const pageTitle = computed(
  () => config.value?.storyMap.sidebar.title ?? "Story Map",
);
</script>

<template>
  <PageLayout :title="pageTitle">
    <template #header-actions>
      <button
        @click="router.push('/story-map')"
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
        Back
      </button>
    </template>
    <StoryMap v-if="config" :config="config" />
  </PageLayout>
</template>
