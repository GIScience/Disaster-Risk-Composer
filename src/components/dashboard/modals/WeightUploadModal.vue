<script setup lang="ts">
import type { WeightUploadMatchResult } from "@/composables/useIndicatorWeights";

const props = defineProps<{
  fileName: string;
  entryCount: number;
  parseError: string | null;
  matchResult: WeightUploadMatchResult;
  formatColName: (col: string) => string;
}>();

defineEmits<{
  (e: "cancel"): void;
  (e: "confirm"): void;
}>();


</script>

<template>
  <v-dialog
    :model-value="true"
    max-width="30rem"
    @update:model-value="$emit('cancel')"
  >
    <v-sheet rounded="xl" class="overflow-hidden">
      <div class="px-7 pt-6 pb-2 flex items-start justify-between">
        <div class="flex items-center gap-3">
          <div
            class="flex items-center justify-center w-10 h-10 rounded-full shrink-0"
            :class="props.parseError ? 'bg-red-100' : 'bg-amber-100'"
          >
            <v-icon
              :icon="
                props.parseError
                  ? 'mdi-alert-circle-outline'
                  : 'mdi-file-upload-outline'
              "
              :class="props.parseError ? 'text-red-600' : 'text-amber-600'"
            />
          </div>
          <h2 class="text-lg font-bold text-slate-900 tracking-tight">
            {{ props.parseError ? "Invalid weights file" : "Review weights upload" }}
          </h2>
        </div>
      </div>

      <div class="px-7 pb-6">
        <p class="text-xs text-slate-500 truncate mb-3">{{ props.fileName }}</p>

        <template v-if="props.parseError">
          <p class="text-sm text-slate-600 leading-relaxed">
            {{ props.parseError }}
          </p>
        </template>
        <template v-else>
          <p class="text-sm text-slate-600 leading-relaxed">
            {{ props.entryCount }}
            {{ props.entryCount === 1 ? "weight entry" : "weight entries" }}
            read.
          </p>
          <p
            class="text-sm mt-2 leading-relaxed font-semibold"
            :class="
              props.matchResult.matched === props.matchResult.total
                ? 'text-success'
                : 'text-amber-700'
            "
          >
            {{ props.matchResult.matched }} of {{ props.matchResult.total }}
            indicators matched a weight entry.
          </p>

          <div v-if="props.matchResult.unmatchedCols.length > 0" class="mt-3">
            <p class="text-xs font-semibold text-slate-500 uppercase mb-1">
              Not found in this file
            </p>
            <ul
              class="text-xs text-slate-600 max-h-32 overflow-auto custom-scrollbar space-y-0.5 list-disc list-inside"
            >
              <li v-for="col in props.matchResult.unmatchedCols" :key="col">
                {{ props.formatColName(col) }}
              </li>
            </ul>
            <p class="text-xs text-slate-400 mt-1.5">
              These indicators will keep their current weight.
            </p>
          </div>
        </template>

        <div class="flex flex-col-reverse sm:flex-row gap-3 mt-6">
          <v-btn
            variant="tonal"
            class="flex-1 normal-case border-2 border-slate-300 text-slate-700 font-semibold shadow-none"
            rounded="lg"
            aria-label="cancel weight upload"
            @click="$emit('cancel')"
          >
            Cancel
          </v-btn>
          <v-btn
            v-if="!props.parseError"
            color="heigit-red"
            variant="flat"
            class="flex-1 normal-case text-white font-semibold hover:bg-heigit-red/90"
            rounded="lg"
            aria-label="confirm weight upload"
            @click="$emit('confirm')"
          >
            Apply Weights
          </v-btn>
        </div>
      </div>
    </v-sheet>
  </v-dialog>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #8b4c4c;
  border-radius: 10px;
}
</style>
