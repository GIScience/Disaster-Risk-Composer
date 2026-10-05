<script setup lang="ts">
import { onMounted, nextTick, ref, watch } from "vue";
import { loadPlotly } from "@/utils/plotly";
import { usePlotlyAutoResize } from "@/composables/usePlotlyAutoResize";

const props = defineProps<{
  data: any[];
}>();

const dependencyRatio = ref<number | null>(null);

usePlotlyAutoResize("demographics-chart");

const renderDemographics = async () => {
  const Plotly = await loadPlotly();
  await nextTick();
  const graphDiv = document.getElementById("demographics-chart");
  if (!graphDiv || !props.data.length) return;

  const cols = new Set(Object.keys(props.data[0]));
  const sumCol = (col: string) =>
    props.data.reduce((sum, row) => sum + (Number(row[col]) || 0), 0);

  // Dependency ratio is a per-region ratio, not a head-count, so it can't be a
  // pie slice - show it separately as a population-weighted average instead.
  if (cols.has("vul_dependency_ratio") && cols.has("vul_total_pop")) {
    let weighted = 0;
    let weight = 0;
    for (const row of props.data) {
      const ratio = Number(row.vul_dependency_ratio);
      const pop = Number(row.vul_total_pop);
      if (isNaN(ratio) || isNaN(pop)) continue;
      weighted += ratio * pop;
      weight += pop;
    }
    dependencyRatio.value = weight > 0 ? weighted / weight : null;
  } else {
    dependencyRatio.value = null;
  }

  // Mutually exclusive age/sex groups (U5, WRA 15-49, 65+), so "Rest" is simply
  // whatever remains of the total population.
  const groups = [
    { col: "vul_children_u5", label: "Children U5" },
    { col: "vul_elderly", label: "Elderly (65+)" },
    { col: "vul_wra_pop", label: "Women of Reproductive Age" },
  ].filter((g) => cols.has(g.col));

  if (groups.length === 0) {
    Plotly.purge(graphDiv as any);
    return;
  }

  const labels = groups.map((g) => g.label);
  const values = groups.map((g) => sumCol(g.col));

  if (cols.has("vul_total_pop")) {
    const rest = sumCol("vul_total_pop") - values.reduce((a, b) => a + b, 0);
    if (rest > 0) {
      labels.push("Rest");
      values.push(rest);
    }
  }

  const trace = {
    labels: labels,
    values: values,
    type: "pie",
    hole: 0.4,
    textinfo: "percent",
    textposition: "inside",
    insidetextorientation: "radial",
    marker: {
      colors: [
        "#e86b3e", // Children U5
        "#f6a44d", // Elderly
        "#ffd156", // Women of reproductive age
        "#f9d5b6", // Rest
      ],
    },
  };

  const layout = {
    font: { family: "Inter, Roboto, sans-serif", color: "#475569" },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    margin: { t: 10, r: 10, b: 100, l: 10 },
    showlegend: true,
    legend: { orientation: "h" },
  };

  try {
    await Plotly.newPlot(graphDiv as any, [trace] as any, layout as any, {
      responsive: true,
      displayModeBar: false,
    });
  } catch (e) {
    console.error("Plotly Demographics Error:", e);
  }
};

onMounted(() => {
  renderDemographics();
});

watch(
  () => props.data,
  () => {
    renderDemographics();
  },
  { deep: true },
);
</script>

<template>
  <section class="h-full min-h-[400px] short:min-h-[280px] flex flex-col">
    <h3
      class="text-lg font-extrabold text-slate-900 mb-2 mt-2 px-2 tracking-tight"
    >
      Vulnerable Demographics
    </h3>
    <p v-if="dependencyRatio !== null" class="px-2 text-sm text-slate-600">
      Dependency ratio:
      <span class="font-bold text-slate-900">{{ dependencyRatio.toFixed(1) }}</span>
      <span class="text-slate-500">
        dependents (0–14 and 65+ years) per 100 working-age people (15–64
        years)</span
      >
    </p>
    <div id="demographics-chart" class="w-full flex-1"></div>
  </section>
</template>
