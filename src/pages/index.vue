<script setup lang="ts">
import MainView from "@/components/dashboard/MainView.vue";
import MobileView from "@/components/dashboard/MobileView.vue";
import ServiceUnavailableView from "@/components/ServiceUnavailableView.vue";
import useScreenSize from "@/composables/use-screen-size";
import { useServiceAvailability } from "@/composables/use-service-availability";

const { isSmallViewport } = useScreenSize();
const { status, isRetrying, retry } = useServiceAvailability();
</script>

<template>
  <ServiceUnavailableView
    v-if="status === 'unavailable'"
    :is-retrying="isRetrying"
    @retry="retry"
  />
  <template v-else>
    <MobileView v-if="isSmallViewport" />
    <MainView v-else />
  </template>
</template>
