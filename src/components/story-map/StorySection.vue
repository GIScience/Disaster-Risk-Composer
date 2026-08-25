<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type {
  Section,
  Note,
  Figure,
  SegmentedOption,
  EquationTerm,
} from "@/types/story-map";
import { useReveal } from "@/composables/useReveal";
import StoryControl from "./StoryControl.vue";
import StoryMapPanel from "./StoryMapPanel.vue";
import StoryMapFigure from "./StoryMapFigure.vue";
import StoryEquation from "./StoryEquation.vue";
import RichText from "./RichText.vue";
import Icon from "./Icon.vue";
import type { layerConfigType } from "@/types/story-map";

const props = defineProps<{ section: Section }>();
const el = ref<HTMLElement | null>(null);
const { revealed } = useReveal(el);

const defaultLayerConfig = computed(() =>
  props.section.control?.type === "segmented"
    ? props.section.control.options.find((c) => c.selected)?.layerConfig
    : props.section.map?.layerConfig,
);

const defaultNote = computed(() =>
  props.section.control?.type === "segmented"
    ? (props.section.control.options.find((c) => c.selected)?.note ??
      props.section.note)
    : props.section.note,
);

const defaultFigure = computed(() =>
  props.section.control?.type === "segmented"
    ? (props.section.control.options.find((c) => c.selected)?.figure ??
      props.section.figure)
    : props.section.figure,
);

// Base/underlay layer (e.g. flood extent), driven by `section.baseControl`
// and rendered beneath the primary `layerConfig` on the same map.
const defaultBaseLayerConfig = computed(() =>
  props.section.baseControl?.type === "segmented"
    ? props.section.baseControl.options.find((c) => c.selected)?.layerConfig
    : undefined,
);

const defaultBaseOption = computed(() =>
  props.section.baseControl?.type === "segmented"
    ? props.section.baseControl.options.find((c) => c.selected)
    : undefined,
);

const defaultOverlayOption = computed(() =>
  props.section.control?.type === "segmented"
    ? props.section.control.options.find((c) => c.selected)
    : undefined,
);

const layerConfig = ref<layerConfigType | undefined>(defaultLayerConfig.value);
const activeNote = ref<Note | undefined>(defaultNote.value);
const activeFigure = ref<Figure | undefined>(defaultFigure.value);
const baseLayerConfig = ref<layerConfigType | undefined>(
  defaultBaseLayerConfig.value,
);
const baseSelected = ref<SegmentedOption | undefined>(defaultBaseOption.value);
const overlaySelected = ref<SegmentedOption | undefined>(
  defaultOverlayOption.value,
);

watch(defaultLayerConfig, (config) => {
  layerConfig.value = config;
});

watch(defaultNote, (note) => {
  activeNote.value = note;
});

watch(defaultFigure, (figure) => {
  activeFigure.value = figure;
});

watch(defaultBaseLayerConfig, (config) => {
  baseLayerConfig.value = config;
});


const equationTerms = computed<EquationTerm[] | undefined>(() => {
  const equation = props.section.equation;
  if (!equation || !baseSelected.value || !overlaySelected.value)
    return undefined;

  return [
    {
      kind: "operand",
      icon: overlaySelected.value.icon,
      label: overlaySelected.value.label,
      sublabel: null,
    },
    { kind: "operator", symbol: equation.operator ?? "+" },
    {
      kind: "operand",
      icon: equation.baseIcon,
      label: equation.baseLabel,
      sublabel: baseSelected.value.label,
    },
  ];
});

const noteBodyItems = computed(() =>
  Array.isArray(activeNote.value?.body)
    ? activeNote.value.body
    : activeNote.value?.body
      ? [activeNote.value.body]
      : [],
);

const noteBgClasses = {
  warning: ["bg-amber-50", "bg-amber-100"],
  info: ["bg-orange-100", "bg-heigit-50"],
} as const;

function noteBgClass(index: number) {
  const palette =
    activeNote.value?.variant === "warning"
      ? noteBgClasses.warning
      : noteBgClasses.info;
  return palette[index % palette.length];
}

// Legend layer names shown in MapLegend, e.g. "Flood Extent (10-years)".
const layerLabel = computed(() => overlaySelected.value?.label);
const baseLayerLabel = computed(() => {
  if (!baseSelected.value) return undefined;
  const baseLabel = props.section.equation?.baseLabel;
  return baseLabel
    ? `${baseLabel} (${baseSelected.value.label})`
    : baseSelected.value.label;
});
</script>

<template>
  <section
    :id="section.id"
    ref="el"
    class="story-section scroll-mt-24 h-full border-gray-200 bg-white border rounded-md"
    :class="{ 'is-revealed': revealed }"
  >
    <div
      class="flex flex-col gap-4 lg:flex-row lg:gap-2"
      :class="section.map ? 'lg:min-h-[700px] lg:items-stretch' : 'lg:items-start'"
    >
      <div
        class="flex min-w-0 flex-col p-4"
        :class="section.map ? 'lg:w-[26rem] xl:w-[33rem] lg:flex-none' : 'w-full'"
      >
        <!-- Title: always pinned to the top -->
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

        <!-- Rest of the content: centered in the remaining column height -->
        <div class="mt-4 flex flex-1 flex-col justify-center gap-4">
          <!-- Figure -->
          <StoryMapFigure
            v-if="activeFigure"
            class="mx-auto w-full rounded-md"
            :figure="activeFigure"
          />

          <!-- Map Layer Control -->
          <StoryControl
            v-if="section.control"
            :control="section.control"
            @change-layer="(config) => (layerConfig = config)"
            @change-note="(note) => (activeNote = note ?? section.note)"
            @change-figure="(figure) => (activeFigure = figure ?? section.figure)"
            @change-option="(option) => (overlaySelected = option)"
          />

          <!-- Equation strip: how the base and primary layers combine -->
          <StoryEquation
            v-if="equationTerms"
            :terms="equationTerms"
            compact
          />

          <!-- Base Layer Control -->
          <StoryControl
            v-if="section.baseControl"
            :control="section.baseControl"
            @change-layer="(config) => (baseLayerConfig = config)"
            @change-option="(option) => (baseSelected = option)"
          />


          <!-- Note -->
          <template v-if="activeNote">
            <div
              v-for="(paragraph, index) in noteBodyItems"
              :key="index"
              class="flex gap-2 rounded-lg px-3 py-1 text-sm text-justify leading-relaxed"
              :class="[
                noteBgClass[index],
                activeNote.variant === 'warning'
                  ? 'text-amber-800'
                  : 'text-gray-950',
              ]"
            >
              <RichText :text="paragraph" />
            </div>
          </template>

          <!-- Data source -->
          <div v-if="section.dataset" class="flex items-center gap-2 text-sm">
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
        </div>
      </div>

      <!-- Map -->
      <StoryMapPanel
        v-if="section.map"
        class="min-h-[700px] w-full min-w-0 flex-1"
        :control="section.map"
        :layer="layerConfig"
        :layer-label="layerLabel"
        :base-layer="baseLayerConfig"
        :base-layer-label="baseLayerLabel"
        :legend="section.legend"
        :visible="revealed"
      >
        <template v-if="$slots.map" #default="{ layerId }">
          <slot name="map" :layer-id="layerId" />
        </template>
      </StoryMapPanel>
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
