<script setup lang="ts">
import { ref, watch } from "vue";

/**
 * Number field to type an exact weight (e.g. 1.35), next to a weight slider or for a whole group.
 * The value is applied on Enter or when the field loses focus, so half-typed numbers ("1.") don't
 * move anything; it's limited to min–max and rounded to two decimals like the slider.
 * value null (a group whose weights differ) leaves the field empty with the placeholder.
 */
const props = withDefaults(
  defineProps<{
    value: number | null;
    min?: number;
    max?: number;
    disabled?: boolean;
    placeholder?: string;
    label?: string;
  }>(),
  { min: 0, max: 5, disabled: false, placeholder: "", label: "Weight" },
);
const emit = defineEmits<{ (e: "update", value: number): void }>();

const format = (v: number | null) => (v === null ? "" : v.toFixed(2));
const text = ref(format(props.value));
const focused = ref(false);

// Follow the slider, but not while the reader is typing
watch(
  () => props.value,
  (v) => {
    if (!focused.value) text.value = format(v);
  },
);

function commit() {
  const parsed = Number(text.value.replace(",", "."));
  if (text.value.trim() === "" || !Number.isFinite(parsed)) {
    text.value = format(props.value); // invalid input: back to the current weight
    return;
  }
  const v = Math.round(Math.min(props.max, Math.max(props.min, parsed)) * 100) / 100;
  text.value = format(v);
  if (v !== props.value) emit("update", v);
}
</script>

<template>
  <input
    v-model="text"
    type="text"
    inputmode="decimal"
    :disabled="disabled"
    :placeholder="placeholder"
    :aria-label="`${label} (${min}–${max})`"
    :title="`${label}: type a value between ${min} and ${max}`"
    class="w-11 rounded placeholder:font-normal placeholder:text-slate-400 border border-solid border-slate-200 bg-white px-1 py-0.5 text-right text-[10px] font-bold tabular-nums text-slate-700 outline-none transition-colors focus:border-heigit-red disabled:bg-slate-50 disabled:text-slate-300"
    @focus="focused = true; ($event.target as HTMLInputElement).select()"
    @blur="focused = false; commit()"
    @keydown.enter="($event.target as HTMLInputElement).blur()"
    @keydown.esc="text = format(value); ($event.target as HTMLInputElement).blur()"
  />
</template>
