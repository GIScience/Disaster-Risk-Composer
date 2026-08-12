<script setup lang="ts">
import { computed } from "vue";
import type { StoryMapConfig } from "@/types/story-map";
import { useScrollSpy } from "@/composables/useScrollSpy";
import StoryMapNavbar from "./StoryMapNavbar.vue";
import StorySection from "./StorySection.vue";
import StoryCallouts from "./StoryCallouts.vue";
import StoryMapHero from "./../story-map/StoryMapHero.vue";

const props = defineProps<{ config: StoryMapConfig }>();
const sm = computed(() => props.config.storyMap);

const { activeId, scrollTo } = useScrollSpy(
  props.config.storyMap.sections.map((s) => s.id),
);

</script>

<template>
  <div class="relative flex min-h-screen space-y-8 w-full flex-col bg-gray-100">
    <!-- hero -->
    <StoryMapHero
      :title="sm.hero.title"
      :subtitle="sm.hero.subtitle"
      :image="sm.hero.image"
    />
    <div
      class="flex flex-col gap-8 lg:flex-row lg:gap-2 mx-auto w-full max-w-[1680px] px-4 py-8 sm:px-6 lg:px-6 xl:px-8"
    >
      <!-- sidebar -->
      <aside class="lg:w-[22rem] lg:flex-none">
        <div class="lg:sticky lg:top-40 px-4">
          <div class="mb-12 flex items-start gap-3">
            <span class="mt-0.5 text-heigit-red">
              <v-icon :icon="sm.sidebar.icon" size="28" />
            </span>
            <div>
              <h1 class="text-xl font-bold leading-tight text-gray-900">
                {{ sm.sidebar.title }}
              </h1>
              <p class="mt-1 text-sm text-gray-500">
                {{ sm.sidebar.subtitle }}
              </p>
            </div>
          </div>

          <StoryMapNavbar
            :steps="sm.sidebar.steps"
            :active-id="activeId"
            @select="scrollTo"
          />

          <div class="mt-6 rounded-lg bg-red-50 p-4 shadow-sm">
            <div
              class="flex items-center gap-2 text-sm font-semibold text-heigit-red"
            >
              <v-icon :icon="sm.sidebar.aside.icon" size="20" />
              {{ sm.sidebar.aside.title }}
            </div>
            <p class="mt-1.5 text-xs leading-relaxed text-gray-600">
              {{ sm.sidebar.aside.body }}
            </p>
          </div>
        </div>
      </aside>

      <!-- main -->
      <main class="min-w-0 flex-1">
        <header
          class="rounded-xl border border-gray-200 mx-auto max-w-3xl bg-white p-6"
        >
          <h2 class="text-lg font-bold text-heigit-400 text-center">
            {{ sm.header.title }}
          </h2>
          <p class="mt-2 text-sm leading-relaxed text-gray-600">
            {{ sm.header.description }}
          </p>
        </header>

        <div class="mt-4 overflow-hidden rounded-xl space-y-16">
          <StorySection
            v-for="section in sm.sections"
            :key="section.id"
            :section="section"
          >
          </StorySection>
        </div>

        <StoryCallouts class="mt-4" :callouts="config.footer.callouts" />
      </main>
    </div>
  </div>
</template>
