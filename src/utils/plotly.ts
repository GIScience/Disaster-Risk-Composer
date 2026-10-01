// Plotly is ~3.5 MB minified and only needed once a chart tab is opened, so it's loaded on
// demand instead of shipping in the initial bundle. The module is cached after the first call.
export async function loadPlotly() {
  return (await import("plotly.js-dist-min")).default;
}
