<script setup lang="ts">
import { onMounted, nextTick, watch } from "vue";
import { loadPlotly } from "@/utils/plotly";
import { usePlotlyAutoResize } from "@/composables/usePlotlyAutoResize";
import { formatRegionLabel } from "@/utils/regionLabel";

const props = defineProps<{
  data: any[];
  selectedDisaster: string;
  pcodeField: string;
  pcodeNames: Record<string, string>;
}>();

const emit = defineEmits<{
  (e: "region-hover", pcode: string | null): void;
}>();


usePlotlyAutoResize("ranking-chart");

const renderRanking = async () => {
  const Plotly = await loadPlotly();
  await nextTick();
  const graphDiv = document.getElementById("ranking-chart");
  if (!graphDiv || !props.data.length || !props.selectedDisaster) return;

  // Get top 15 highest risk
  const topData = [...props.data]
    .filter((d) => !isNaN(Number(d[props.selectedDisaster])))
    .sort(
      (a, b) =>
        Number(b[props.selectedDisaster]) - Number(a[props.selectedDisaster]),
    )
    .slice(0, 15)
    .reverse(); // Reverse for Plotly horizontal bar chart (bottom to top)

  // y stays the raw pcode - it's what plotly_hover reports below, and that
  // value drives the map's hover-highlight, so it can't become a display label.
  const yValues = topData.map((d) => d[props.pcodeField]);
  const displayLabels = yValues.map((pcode) =>
    formatRegionLabel(pcode, props.pcodeNames),
  );
  // Long names (e.g. "Antananarivo Atsimondrano") would otherwise be clipped at the chart's left
  // edge in a narrow panel - shorten the axis label only, the hover keeps the full name.
  const MAX_TICK_NAME = 18;
  const tickLabels = yValues.map((pcode) => {
    const name = props.pcodeNames[pcode];
    if (!name) return pcode;
    const short =
      name.length > MAX_TICK_NAME ? `${name.slice(0, MAX_TICK_NAME - 1)}…` : name;
    return `${short} (${pcode})`;
  });
  const xValues = topData.map((d) => Number(d[props.selectedDisaster]));

  const trace = {
    x: xValues,
    y: yValues,
    customdata: displayLabels,
    type: "bar",
    orientation: "h",
    marker: {
      color: xValues,
      colorscale: [
        [0, "#ffd156"],
        [0.5, "#e86b3e"],
        [1, "#cc0130"],
      ],
    },
    text: xValues.map((v) => v.toFixed(3)),
    textposition: "auto",
    hovertemplate: "%{customdata}<br>Risk Score: %{x:.3f}<extra></extra>",
  };

  const layout = {
    font: { family: "Inter, Roboto, sans-serif", color: "#475569" },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
    xaxis: {
      title: "Risk Score",
      // Headroom so a value label pushed outside the longest bar isn't clipped.
      range: [0, Math.max(...xValues, 0) * 1.12],
      gridcolor: "#e2e8f0",
      zerolinecolor: "#e2e8f0",
      automargin: true,
    },
    yaxis: {
      automargin: true,
      tickfont: { size: 10, color: "#475569" },
      tickvals: yValues,
      ticktext: tickLabels,
    },
    margin: { t: 10, r: 10, b: 10, l: 20 },
  };

  try {
    await Plotly.newPlot(graphDiv as any, [trace] as any, layout as any, {
      responsive: true,
      displayModeBar: false,
    });
    (graphDiv as any).on("plotly_hover", (data: any) => {
      if (data.points && data.points.length > 0) {
        emit("region-hover", data.points[0].y); // Horizontal bar, so y is the PCODE
      }
    });
    (graphDiv as any).on("plotly_unhover", () => emit("region-hover", null));
  } catch (e) {
    console.error("Plotly Ranking Error:", e);
  }
};

onMounted(() => {
  renderRanking();
});

watch(
  [() => props.data, () => props.selectedDisaster, () => props.pcodeNames],
  () => {
    renderRanking();
  },
  { deep: true },
);
</script>

<template>
  <section class="h-full min-h-[400px] short:min-h-[280px] flex flex-col">
    <h3
      class="text-lg font-extrabold text-slate-900 mb-2 mt-2 px-2 tracking-tight"
    >
      Top 15 Regions
    </h3>
    <div id="ranking-chart" class="flex-1 w-full min-w-0"></div>
  </section>
</template>
