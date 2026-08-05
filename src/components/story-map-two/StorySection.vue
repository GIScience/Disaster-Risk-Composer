<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { Section } from "@/types/story-map";
import { useReveal } from "@/composables/useReveal";
import StoryControl from "./StoryControl.vue";
import StoryMapPanel from "./StoryMapPanel.vue";
import StoryMapFigure from "./StoryMapFigure.vue";
import RichText from "./RichText.vue";
import Icon from "./Icon.vue";
import type { layerConfigType } from "@/types/story-map";

const props = defineProps<{ section: Section }>();
const el = ref<HTMLElement | null>(null);
const { revealed } = useReveal(el);

const defaultLayerConfig = computed(() =>
  props.section.control?.type === "segmented"
    ? props.section.control.options.find((c) => c.selected)?.layerConfig
    : undefined,
);

const layerConfig = ref<layerConfigType | undefined>(defaultLayerConfig.value);

watch(defaultLayerConfig, (config) => {
  layerConfig.value = config;
});
</script>

<template>
  <section
    :id="section.id"
    ref="el"
    class="story-section scroll-mt-24 h-full border-gray-200 bg-white border rounded-md"
    :class="{ 'is-revealed': revealed }"
  >
    <div class="flex flex-col gap-5 lg:gap-4">
      <div class="p-3 lg:flex-none">
        <div>
          <h3
            class="flex items-center gap-1.5 text-base font-bold text-gray-900"
          >
            <span class="text-gray-400">{{ section.number }}.</span>
            {{ section.title }}
            <v-icon
              v-if="section.hasInfoIcon"
              :icon="section.icon"
              class="h-3.5 w-3.5 text-heigit-red"
            />
          </h3>
          <p v-if="section.subtitle" class="mt-1 text-sm text-gray-500">
            {{ section.subtitle }}
          </p>
        </div>

        <!-- Map Layer Control -->
        <StoryControl
          v-if="section.control"
          class="mt-4"
          :control="section.control"
          @change-layer="(config) => (layerConfig = config)"
        />

        <!-- Map -->
        <StoryMapPanel
          v-if="section.map"
          class="min-h-[300px] min-w-0 flex-1 my-4"
          :control="section.map"
          :layer="layerConfig"
          :visible="revealed"
        >
          <template v-if="$slots.map" #default="{ layerId }">
            <slot name="map" :layer-id="layerId" />
          </template>
        </StoryMapPanel>

        <!-- Data source -->
        <div
          v-if="section.dataset"
          class="mt-3 flex items-center gap-2 text-sm"
        >
          <Icon :name="section.dataset.icon" class="h-4 w-4 text-emerald-500" />
          <div>
            <div class="font-medium text-gray-700">
              {{ section.dataset.title }}
            </div>
            <div class="text-xs text-gray-400">
              {{ section.dataset.source }}
            </div>
          </div>
        </div>

        <!-- Note -->
        <div
          v-if="section.note"
          class="mt-4 flex gap-2 rounded-lg p-3 text-xs leading-relaxed"
          :class="
            section.note.variant === 'warning'
              ? 'bg-amber-50 text-amber-800'
              : 'bg-blue-50 text-gray-600'
          "
        >
          <RichText :text="section.note.body" />
        </div>
      </div>

      <!-- Figure -->
      <StoryMapFigure
        v-if="section.figure"
        class="mx-auto w-full max-w-3xl rounded-md"
        :figure="section.figure"
      />
    </div>
  </section>
</template>

<style scoped>
.story-section {
  opacity: 0;
  transform: translateY(12px);
  transition:
    opacity 0.5s ease,
    transform 0.5s ease;
}
.story-section.is-revealed {
  opacity: 1;
  transform: none;
}
@media (prefers-reduced-motion: reduce) {
  .story-section {
    opacity: 1;
    transform: none;
    transition: none;
  }
}
</style>
