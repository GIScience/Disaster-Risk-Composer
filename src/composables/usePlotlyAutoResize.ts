import { onBeforeUnmount, onMounted } from "vue";
import { loadPlotly } from "@/utils/plotly";

/**
 * Re-fits a Plotly chart whenever its container changes size. Plotly's own `responsive: true`
 * only listens to window resizes, so a chart drawn while the analysis panel is still animating
 * open (or later collapsed/expanded) would otherwise keep its stale width and overflow.
 */
export function usePlotlyAutoResize(elementId: string) {
  let observer: ResizeObserver | null = null;
  let frame: number | null = null;

  onMounted(() => {
    const el = document.getElementById(elementId);
    if (!el) return;
    observer = new ResizeObserver(() => {
      if (frame !== null) cancelAnimationFrame(frame);
      frame = requestAnimationFrame(async () => {
        frame = null;
        // Only resize once a plot exists - the first render happens separately.
        if (!(el as any)._fullLayout) return;
        const Plotly = await loadPlotly();
        Plotly.Plots.resize(el);
      });
    });
    observer.observe(el);
  });

  onBeforeUnmount(() => {
    observer?.disconnect();
    if (frame !== null) cancelAnimationFrame(frame);
  });
}
