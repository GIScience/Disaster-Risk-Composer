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

const riverFlood = "/river_flood.png";
const imageSrc1 = `${import.meta.env.BASE_URL}${riverFlood.replace(/^\//, "")}`;

const overview = "/flood_impact_diagram.png";
const imageSrc2 = `${import.meta.env.BASE_URL}${overview.replace(/^\//, "")}`;

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
      class="flex flex-col gap-8 lg:flex-row lg:gap-2 mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8"
    >
      <!-- sidebar -->
      <aside class="lg:w-[24rem] lg:flex-none">
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
        <header class="rounded-xl border border-gray-200 bg-white p-6">
          <h2 class="text-lg font-bold text-gray-900">{{ sm.header.title }}</h2>
          <p class="mt-2 max-w-3xl text-sm leading-relaxed text-gray-600">
            {{ sm.header.description }}
          </p>
        </header>

        <div class="mt-4 overflow-hidden rounded-xl space-y-4">
          <StorySection
            v-for="section in sm.sections"
            :key="section.id"
            :section="section"
          >
          </StorySection>
        </div>

        <StoryCallouts class="mt-4" :callouts="config.footer.callouts" />
        <section class="mt-8">
          <h2>How Theory Becomes Reality</h2>
          <img
            :src="imageSrc1"
            alt="River Flood"
            class="mt-4 w-full rounded-md border border-gray-200 bg-gray-100"
          />
          <div class="mt-4 gap-6 rounded-md border border-gray-200 bg-white p-6">
            <h3 class="text-base font-bold text-gray-900">
              🌊 From Forecast to Action: How It Actually Works
            </h3>
            <p class="mt-2 text-sm leading-relaxed text-gray-600">
              Turning a 10-day weather forecast into a life-saving map takes
              three connected steps:
            </p>
            <ol class="mt-3 space-y-2 text-sm leading-relaxed text-gray-600 mx-4">
              <li>
                <strong>Predict:</strong> Daily weather forecasts feed
                into a river simulation model, showing where rivers are
                likely to rise before the rain even falls.
              </li>
              <li>
                <strong>Map:</strong> We check whether that rise will
                overwhelm local flood defenses, then draw the exact flooded
                area down to ~90m resolution — not a guess, an explicit
                picture.
              </li>
              <li>
                <strong>Prioritize:</strong> We overlay that map with
                where people, hospitals, and roads actually are, then rank
                each district by two things: how many people are exposed,
                and how soon the water will arrive.
              </li>
            </ol>
            <p class="mt-3 text-sm leading-relaxed text-gray-600">
              ✅ The result: a daily-updated map telling emergency teams
              exactly where to act first.
            </p>
          </div>
          <img
            :src="imageSrc2"
            alt="Overview of Flood Exposure"
            class="mt-4 w-full rounded-md border border-gray-200 bg-gray-100"
          />
          <!-- <h3>Participatory Mapping for Disaster Risk</h3> -->
        </section>
      </main>
    </div>
  </div>
</template>
