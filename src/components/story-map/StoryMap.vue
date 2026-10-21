<script setup lang="ts">
import { computed, onMounted } from "vue";
import { getCogMetadata } from "@geomatico/maplibre-cog-protocol";
import { provideStoryText } from "@/composables/useStoryText";
import { uiText } from "@/utils/story-map-content";
import type { StoryMapConfig } from "@/types/story-map";
import { useScrollSpy } from "@/composables/useScrollSpy";
import { collectCogUrls } from "@/utils/cogUrls";
import StoryMapNavbar from "./StoryMapNavbar.vue";
import StorySection from "./StorySection.vue";
import StoryCallouts from "./StoryCallouts.vue";
import StoryAnatomy from "./StoryAnatomy.vue";
import StoryEquation from "./StoryEquation.vue";

const props = defineProps<{ config: StoryMapConfig }>();
// Wording for the components below (from the text.md files)
provideStoryText(() => props.config.ui);
const t = (key: string) => uiText(props.config.ui, key);
const sm = computed(() => props.config.storyMap);

// Before the first tile of a Cloud-Optimized GeoTIFF can load, the COG library reads the file's
// internal directory level by level - many small requests, strictly one after another. Doing that
// in the background as soon as the page opens (the library caches it per file URL) means the maps
// only have to fetch the tiles themselves. The tiles of all layers are then preloaded by each map
// (see StoryMapCanvas).
onMounted(() => {
  collectCogUrls(props.config.storyMap.sections).forEach((url) =>
    getCogMetadata(url).catch(() => {}),
  );
});

const { activeId, scrollTo } = useScrollSpy(
  props.config.storyMap.sections.map((s) => s.id),
);

</script>

<template>
  <div class="min-h-screen w-full bg-gray-50">
    <div
      class="mx-auto grid w-full max-w-[1440px] grid-cols-1 gap-6 px-4 py-6 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-8 lg:px-6"
    >
      <!-- Sidebar -->
      <aside>
        <div class="lg:sticky lg:top-20">
          <!-- Back to the story map overview (the header button leads to the dashboard) -->
          <a
            href="#/story-map"
            class="inline-flex items-center gap-1.5 text-sm font-medium text-heigit-red no-underline hover:underline"
          >
            <v-icon icon="mdi-arrow-left" size="18" />
            {{ t("back") }}
          </a>

          <div class="mt-6 flex items-start gap-3">
            <v-icon :icon="sm.sidebar.icon" size="40" class="flex-none text-heigit-red" />
            <h1 class="text-2xl font-extrabold leading-tight text-gray-900">
              {{ sm.sidebar.title }}
            </h1>
          </div>
          <p class="mt-2 text-sm leading-relaxed text-gray-600">
            {{ sm.sidebar.subtitle }}
          </p>

          <StoryMapNavbar
            class="mt-6"
            :steps="sm.sidebar.steps"
            :active-id="activeId"
            @select="scrollTo"
          />

          <div class="mt-6 rounded-lg bg-red-50 p-4">
            <div class="flex items-center gap-2 text-sm font-semibold text-heigit-red">
              <v-icon :icon="sm.sidebar.aside.icon" size="18" />
              {{ sm.sidebar.aside.title }}
            </div>
            <p class="mt-1.5 text-xs leading-relaxed text-gray-600">
              {{ sm.sidebar.aside.body }}
            </p>
          </div>
        </div>
      </aside>

      <!-- Main -->
      <main class="min-w-0">
        <header class="rounded-xl border border-gray-200 bg-white px-6 py-5 shadow-sm">
          <StoryAnatomy
            v-if="sm.anatomy"
            :anatomy="sm.anatomy"
            :section-order="sm.sections.map((s) => s.id)"
            @select="scrollTo"
          />
          <h2 v-else class="text-lg font-bold text-gray-900">{{ sm.header.title }}</h2>
          <p
            v-if="sm.header.description"
            class="mt-2 max-w-4xl text-sm leading-relaxed text-gray-600"
          >
            {{ sm.header.description }}
          </p>
          <StoryEquation
            v-if="sm.header.equation?.terms?.length"
            class="mt-5"
            :terms="sm.header.equation.terms"
          />
        </header>

        <div
          class="mt-4 divide-y divide-gray-200 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
        >
          <StorySection v-for="section in sm.sections" :key="section.id" :section="section" />
        </div>

        <StoryCallouts
          v-if="config.footer.callouts?.length"
          class="mt-4"
          :callouts="config.footer.callouts"
        />
      </main>
    </div>
  </div>
</template>
