<script setup lang="ts">
import { computed, ref, watch } from "vue";
import type { IndicatorDecoder } from "@/types/story-map";
import { describeIndicator } from "@/utils/indicatorDescription";

const props = defineProps<{ decoder: IndicatorDecoder }>();

const scenario = ref(
  (props.decoder.scenarios.find((s) => s.selected) ?? props.decoder.scenarios[0]).value,
);
const subjectValue = ref(
  (props.decoder.subjects.find((s) => s.selected) ?? props.decoder.subjects[0]).value,
);
const subject = computed(
  () => props.decoder.subjects.find((s) => s.value === subjectValue.value)!,
);
const measure = ref(subject.value.measures?.[0]?.value ?? "");
watch(subject, (s) => {
  measure.value = s.measures?.[0]?.value ?? "";
});

// Same column names as the dashboard data, explained by the same function as the dashboard's
// indicator tooltips - so the story map and the dashboard can't drift apart.
const column = computed(() =>
  subject.value.pattern
    .replace("{scenario}", scenario.value)
    .replace("{measure}", measure.value),
);
const description = computed(
  () => describeIndicator(column.value) ?? "No description available for this combination.",
);
// How the Indicators tab labels the column
const dashboardLabel = computed(() =>
  column.value.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
);
</script>

<template>
  <div class="rounded-xl border border-gray-200 bg-gray-50 p-4">
    <div class="grid gap-3 sm:grid-cols-3">
      <label class="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {{ decoder.scenarioLabel }}
        <select
          v-model="scenario"
          class="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-gray-900"
        >
          <option v-for="s in decoder.scenarios" :key="s.value" :value="s.value">
            {{ s.label }}
          </option>
        </select>
      </label>
      <label class="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-gray-500">
        {{ decoder.subjectLabel }}
        <select
          v-model="subjectValue"
          class="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-gray-900"
        >
          <option v-for="s in decoder.subjects" :key="s.value" :value="s.value">
            {{ s.label }}
          </option>
        </select>
      </label>
      <label
        v-if="subject.measures?.length"
        class="flex flex-col gap-1 text-xs font-semibold uppercase tracking-wider text-gray-500"
      >
        {{ decoder.measureLabel ?? "Measure" }}
        <select
          v-model="measure"
          class="rounded-md border border-gray-300 bg-white px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-gray-900"
        >
          <option v-for="m in subject.measures" :key="m.value" :value="m.value">
            {{ m.label }}
          </option>
        </select>
      </label>
    </div>

    <div class="mt-4 rounded-lg border border-red-100 bg-white p-4" aria-live="polite">
      <p class="text-base font-semibold leading-relaxed text-gray-900">{{ description }}</p>
      <dl class="mt-3 grid gap-x-4 gap-y-1 text-xs text-gray-500 sm:grid-cols-[auto_1fr]">
        <dt>In the data</dt>
        <dd><code class="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">{{ column }}</code></dd>
        <dt>In the dashboard</dt>
        <dd>{{ decoder.dashboardPath ?? "Indicators tab" }} → “{{ dashboardLabel }}”</dd>
      </dl>
    </div>
  </div>
</template>
