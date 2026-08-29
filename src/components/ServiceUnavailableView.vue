<script setup lang="ts">
import PageLayout from "@/layout/PageLayout.vue";

defineProps<{
  isRetrying?: boolean;
}>();

const emit = defineEmits<{
  (e: "retry"): void;
}>();

const CONTACT_EMAIL = "communications@heigit.org";
</script>

<template>
  <PageLayout full-height>
    <template #header-actions><span /></template>
    <div class="flex-1 flex items-center justify-center px-4 py-12">
      <div
        class="max-w-md w-full bg-white border border-slate-200 rounded-2xl shadow-2xl p-8 text-center"
      >
        <div
          class="mx-auto mb-4 flex items-center justify-center w-12 h-12 rounded-full bg-red-50"
        >
          <v-icon icon="mdi-cloud-off-outline" size="24" class="text-heigit-red" />
        </div>
        <h2 class="text-lg font-extrabold text-slate-900">Data Unavailable</h2>
        <p class="mt-2 text-sm text-slate-500">
          The data is currently unavailable. Please try again later or contact
          us at
          <a
            :href="`mailto:${CONTACT_EMAIL}`"
            class="text-heigit-red hover:underline font-bold"
            >{{ CONTACT_EMAIL }}</a
          >.
        </p>
        <button
          type="button"
          :disabled="isRetrying"
          @click="emit('retry')"
          class="mt-6 bg-heigit-red text-white px-5 py-2.5 rounded-lg text-sm font-bold shadow-md hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100"
        >
          {{ isRetrying ? "Retrying…" : "Retry" }}
        </button>
      </div>
    </div>
  </PageLayout>
</template>
