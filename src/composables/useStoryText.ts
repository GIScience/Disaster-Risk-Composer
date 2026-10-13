import { computed, inject, provide } from "vue";
import type { ComputedRef, InjectionKey } from "vue";
import { uiList, uiText } from "@/utils/story-map-content";

/**
 * Wording used inside the story-map components (buttons, chart labels, graphic captions). It comes
 * from the `ui` part of the story map's text.md files: shared wording from
 * _template/text.md, hazard-specific wording from the hazard's own text.md.
 */
const KEY: InjectionKey<ComputedRef<Record<string, unknown>>> = Symbol("story-ui-text");

/** Reactive, so the wording follows when the page switches to another story map. */
export function provideStoryText(ui: () => Record<string, unknown> | undefined) {
  provide(
    KEY,
    computed(() => ui() ?? {}),
  );
}

export function useStoryText() {
  const ui = inject(
    KEY,
    computed(() => ({})),
  );
  return {
    t: (key: string, vars?: Record<string, string | number>) => uiText(ui.value, key, vars),
    list: (key: string) => uiList(ui.value, key),
  };
}
