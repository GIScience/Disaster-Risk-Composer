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
import StoryCallouts from "./StoryCallouts.vue";
import StoryLegend from "./StoryLegend.vue";
import StoryDepthProfile from "./StoryDepthProfile.vue";
import StoryWindProfile from "./StoryWindProfile.vue";
import StoryCategoryOverlap from "./StoryCategoryOverlap.vue";
import StoryAggregation from "./StoryAggregation.vue";
import StoryScoreScale from "./StoryScoreScale.vue";
import StoryIndicatorDecoder from "./StoryIndicatorDecoder.vue";
import RichText from "./RichText.vue";
import type { layerConfigType, StackLayer } from "@/types/story-map";

const props = defineProps<{ section: Section }>();
// The selected option can override the legend, the map's results box and the aggregation data type.
const activeLegend = computed(() => overlaySelected.value?.legend ?? props.section.legend);
const activeMap = computed(() =>
  props.section.map
    ? { ...props.section.map, results: overlaySelected.value?.results ?? props.section.map.results }
    : undefined,
);
const aggregationKind = computed(() => overlaySelected.value?.dataKind ?? "raster");
// Steps with a map or figure get the two-column row; text-only steps use the full width.
const hasVisual = computed(
  () =>
    !!props.section.map ||
    !!props.section.figure ||
    props.section.visual === "depth-profile" ||
    props.section.visual === "wind-profile" ||
    props.section.visual === "score-scale",
);
const el = ref<HTMLElement | null>(null);
const { revealed } = useReveal(el);
// Start the map about one screen before the step scrolls into view, so it has finished loading
// by the time the reader gets there.
const { revealed: nearView } = useReveal(el, { threshold: 0, rootMargin: "100% 0px" });

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

// const noteBgClasses = {
//   warning: ["bg-amber-50", "bg-amber-100"],
//   info: ["bg-orange-100", "bg-heigit-50"],
// } as const;

// function noteBgClass(index: number) {
//   const palette =
//     activeNote.value?.variant === "warning"
//       ? noteBgClasses.warning
//       : noteBgClasses.info;
//   return palette[index % palette.length];
// }

// Legend layer names shown in MapLegend, e.g. "Flood Extent (10-years)".
const layerLabel = computed(() => overlaySelected.value?.label);

// Key figure split into number and unit ("27.2 M" → "27.2" + "M"), so the unit can be smaller
const statParts = computed(() => {
  const value = overlaySelected.value?.stat?.value ?? "";
  const m = value.match(/^([\d.,]+%?)\s*(.*)$/);
  return m ? { number: m[1], unit: m[2] } : { number: value, unit: "" };
});

// All options' layers on one map, the selected one highlighted (map.stackOptions /
// map.stackBaseOptions)
function toStack(control: Section["control"], selected: SegmentedOption | undefined) {
  if (control?.type !== "segmented") return undefined;
  return control.options
    .filter((o) => o.layerConfig)
    .map((o) => ({
      ...o.layerConfig!,
      label: o.layerConfig!.legendLabel ?? o.label,
      active: o.value === selected?.value,
    }));
}
const stackLayers = computed<StackLayer[] | undefined>(() =>
  props.section.map?.stackOptions ? toStack(props.section.control, overlaySelected.value) : undefined,
);
const baseStackLayers = computed<StackLayer[] | undefined>(() =>
  props.section.map?.stackBaseOptions
    ? toStack(props.section.baseControl, baseSelected.value)
    : undefined,
);
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
    class="story-section scroll-mt-24"
    :class="{ 'is-revealed': revealed }"
  >
    <div
      class="grid grid-cols-1"
      :class="hasVisual ? 'lg:grid-cols-[22rem_minmax(0,1fr)]' : ''"
    >
      <!-- Left: explanation and controls -->
      <div class="flex min-w-0 flex-col gap-4 p-5">
        <div>
          <h3 class="flex items-center gap-1.5 text-[15px] font-bold text-gray-900">
            <span>{{ section.number }}.</span>
            {{ section.title }}
            <v-icon icon="mdi-information-outline" size="16" class="text-heigit-red" />
          </h3>
          <p v-if="section.subtitle" class="mt-1 text-sm text-gray-500">
            {{ section.subtitle }}
          </p>
        </div>

        <StoryControl
          v-if="section.control"
          :control="section.control"
          @change-layer="(config) => (layerConfig = config)"
          @change-note="(note) => (activeNote = note ?? section.note)"
          @change-figure="(figure) => (activeFigure = figure ?? section.figure)"
          @change-option="(option) => (overlaySelected = option)"
        />

        <!-- Key figure of the selected option -->
        <div
          v-if="overlaySelected?.stat"
          class="flex items-center gap-3 rounded-lg bg-red-50 px-4 py-3"
        >
          <div
            class="min-w-[6.25rem] flex-none whitespace-nowrap text-3xl font-black tabular-nums leading-none text-heigit-red"
          >
            {{ statParts.number }}<span v-if="statParts.unit" class="ml-0.5 text-xl">{{ statParts.unit }}</span>
          </div>
          <div class="text-xs font-medium leading-snug text-gray-700">
            {{ overlaySelected.stat.label }}
          </div>
        </div>

        <StoryEquation v-if="equationTerms" :terms="equationTerms" compact />

        <StoryControl
          v-if="section.baseControl"
          :control="section.baseControl"
          @change-layer="(config) => (baseLayerConfig = config)"
          @change-option="(option) => (baseSelected = option)"
        />

        <!-- Legend as a list (choropleth steps) -->
        <StoryLegend v-if="activeLegend" :legend="activeLegend" />

        <!-- Info box -->
        <div
          v-if="activeNote"
          class="flex gap-2.5 rounded-lg px-3.5 py-3 text-xs leading-relaxed"
          :class="activeNote.variant === 'warning' ? 'bg-amber-50 text-amber-900' : 'bg-red-50/70 text-gray-700'"
        >
          <v-icon
            icon="mdi-information-outline"
            size="16"
            class="mt-px flex-none"
            :class="activeNote.variant === 'warning' ? 'text-amber-600' : 'text-heigit-red'"
          />
          <div class="flex flex-col gap-1.5">
            <RichText v-for="(paragraph, index) in noteBodyItems" :key="index" :text="paragraph" />
          </div>
        </div>

        <!-- Figure (no map in this step: shown on the right instead) -->
        <StoryMapFigure
          v-if="activeFigure && section.map"
          class="w-full rounded-md"
          :figure="activeFigure"
        />

        <StoryCategoryOverlap
          v-if="section.explainer?.type === 'category-overlap'"
          :caption="section.explainer.caption"
        />
        <StoryEquation v-if="section.flow" :terms="section.flow" compact />
        <StoryCallouts v-if="section.callouts" :callouts="section.callouts" />
        <StoryIndicatorDecoder v-if="section.decoder" :decoder="section.decoder" />

        <div v-if="section.links?.length" class="flex flex-wrap gap-2">
          <a
            v-for="link in section.links"
            :key="link.href"
            :href="link.href"
            :target="link.external ? '_blank' : undefined"
            :rel="link.external ? 'noopener noreferrer' : undefined"
            class="inline-flex items-center gap-1.5 rounded-lg bg-heigit-red px-4 py-2 text-sm font-semibold text-white no-underline shadow-sm transition-colors hover:bg-red-700"
          >
            <v-icon v-if="link.icon" :icon="link.icon" size="18" />
            {{ link.label }}
          </a>
        </div>

        <div
          v-if="section.dataset"
          class="mt-auto flex items-center gap-2 pt-1 text-xs"
        >
          <v-icon :icon="section.dataset.icon" size="18" class="text-gray-400" />
          <div>
            <div class="font-medium text-gray-700">{{ section.dataset.title }}</div>
            <div class="text-gray-400">{{ section.dataset.source }}</div>
          </div>
        </div>
      </div>

      <!-- Right: map, or the step's figure when it has no map -->
      <StoryMapPanel
        v-if="section.map"
        class="h-[340px] w-full min-w-0 border-t border-gray-200 lg:h-auto lg:min-h-[340px] lg:border-l lg:border-t-0"
        :control="activeMap!"
        :layer="layerConfig"
        :layer-label="layerLabel"
        :base-layer="baseLayerConfig"
        :base-layer-label="baseLayerLabel"
        :stack-layers="stackLayers"
        :base-stack-layers="baseStackLayers"
        :visible="nearView"
      >
        <template v-if="$slots.map" #default="{ layerId }">
          <slot name="map" :layer-id="layerId" />
        </template>
      </StoryMapPanel>
      <div
        v-else-if="section.visual === 'depth-profile'"
        class="flex items-center justify-center border-t border-gray-200 bg-gray-50 p-6 lg:border-l lg:border-t-0"
      >
        <StoryDepthProfile class="w-full max-w-xl" />
      </div>
      <div
        v-else-if="section.visual === 'wind-profile'"
        class="flex items-center justify-center border-t border-gray-200 bg-gray-50 p-6 lg:border-l lg:border-t-0"
      >
        <StoryWindProfile class="w-full max-w-xl" />
      </div>
      <div
        v-else-if="section.visual === 'score-scale' && section.visualValuesUrl"
        class="flex items-center justify-center border-t border-gray-200 bg-gray-50 p-6 lg:border-l lg:border-t-0"
      >
        <StoryScoreScale
          class="w-full max-w-2xl"
          :values-url="section.visualValuesUrl"
          :unit-label="section.visualUnitLabel"
        />
      </div>
      <div
        v-else-if="activeFigure"
        class="flex items-center justify-center border-t border-gray-200 bg-gray-50 p-6 lg:border-l lg:border-t-0"
      >
        <StoryMapFigure class="w-full max-w-xl" :figure="activeFigure" />
      </div>
    </div>

    <!-- Full-width visual below the row -->
    <div v-if="section.visual === 'aggregation'" class="border-t border-gray-200 bg-gray-50 px-5 py-5">
      <StoryAggregation :kind="aggregationKind" :hazard="section.visualHazard" />
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
