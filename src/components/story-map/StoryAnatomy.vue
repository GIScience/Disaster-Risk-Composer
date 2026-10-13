<script setup lang="ts">
import { computed } from "vue";
import type { Anatomy } from "@/types/story-map";
import { useStoryText } from "@/composables/useStoryText";

const props = defineProps<{ anatomy: Anatomy; sectionOrder?: string[] }>();
const emit = defineEmits<{ (e: "select", sectionRef: string): void }>();

// The question stays one plain sentence (readable, copyable, screen-reader friendly);
// its parts are explained as cards below instead of being marked up inside the sentence.
const { t } = useStoryText();
// Parts come trimmed from text.md: join them with spaces, but not before punctuation
const sentence = computed(() =>
  props.anatomy.parts
    .map((p) => p.text.trim())
    .reduce((s, part) => (!s ? part : /^[,.;:!?]/.test(part) ? s + part : `${s} ${part}`), ""),
);
// Cards follow the order of the steps they link to (not the word order of the sentence)
const cards = computed(() => {
  const withRole = props.anatomy.parts.filter((p) => p.role);
  const order = props.sectionOrder ?? [];
  const pos = (ref?: string) => {
    const i = ref ? order.indexOf(ref) : -1;
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  return [...withRole].sort((a, b) => pos(a.sectionRef) - pos(b.sectionRef));
});
</script>

<template>
  <div>
    <h2 class="text-lg font-bold leading-snug text-gray-900 sm:text-xl">
      {{ t("anatomy.question", { sentence }) }}
    </h2>

    <div class="mt-4 grid grid-cols-2 gap-2 lg:grid-cols-4">
      <button
        v-for="part in cards"
        :key="part.role"
        type="button"
        class="group flex flex-col items-start gap-1 rounded-lg border border-solid border-gray-200 bg-white p-3 text-left transition-colors hover:border-heigit-red hover:bg-red-50"
        @click="part.sectionRef && emit('select', part.sectionRef)"
      >
        <span class="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">
          <v-icon v-if="part.icon" :icon="part.icon" size="14" class="text-heigit-red" />
          {{ part.role }}
        </span>
        <span class="text-sm font-bold text-heigit-red">{{ part.text.trim() }}</span>
        <span v-if="part.hint" class="text-xs leading-snug text-gray-500">{{ part.hint }}</span>
        <span class="mt-auto pt-1 text-[11px] font-medium text-gray-400 group-hover:text-heigit-red">
          {{ t("anatomy.seeStep") }}
        </span>
      </button>
    </div>

    <p v-if="anatomy.column" class="mt-3 text-xs text-gray-500">
      {{ t("decoder.inData") }}:
      <code class="rounded bg-gray-100 px-1.5 py-0.5 text-gray-700">{{ anatomy.column }}</code>
    </p>
  </div>
</template>
