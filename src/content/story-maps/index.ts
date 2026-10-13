/**
 * All story maps, built from the shared template, each hazard's config.json and its text.md.
 * See README.md in this folder for how the files fit together.
 */
import type { StoryMapConfig } from "@/types/story-map";
import { buildStoryMap } from "@/utils/story-map-content";
import template from "./_template/template.json";
import templateText from "./_template/text.md?raw";

const configs = import.meta.glob<Record<string, unknown>>("./*/config.json", {
  eager: true,
  import: "default",
});
const texts = import.meta.glob<string>("./*/text.md", { eager: true, query: "?raw", import: "default" });

export const storyMaps: Record<string, StoryMapConfig> = {};
for (const [path, config] of Object.entries(configs)) {
  const id = path.split("/")[1];
  if (id.startsWith("_")) continue; // _template is not a story map
  storyMaps[id] = buildStoryMap({
    template,
    templateText,
    config,
    text: texts[`./${id}/text.md`] ?? "",
    name: id,
  }) as unknown as StoryMapConfig;
}
