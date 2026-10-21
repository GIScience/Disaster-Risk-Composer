<script setup lang="ts">
import { ref } from "vue";

const props = defineProps<{
  storyMap: {
    id: string;
    image: string;
    alt: string;
    imageCredit?: string;
    compareImage?: string;
    compareAlt?: string;
    compareLabel?: string;
    imageLabel?: string;
    title: string;
    summary: string;
  };
}>();

const publicUrl = (path: string) => `${import.meta.env.BASE_URL}${path.replace(/^\//, "")}`;
const imageSrc = publicUrl(props.storyMap.image);
const compareSrc = props.storyMap.compareImage ? publicUrl(props.storyMap.compareImage) : null;

// Before/after slider (like NASA Earth Observatory's image comparisons): the "before" image is
// shown left of the divider, the main image right of it. The divider starts on the left, so the
// card first shows mostly the main image. With a mouse it follows the pointer (a click still
// opens the story map); on touch screens the handle is dragged. A corner label is hidden while
// its image is mostly covered.
const START = 25;
const split = ref(START);
const following = ref(false); // no transition while the divider follows the pointer
const frame = ref<HTMLElement | null>(null);
let dragged = false;

function moveTo(clientX: number) {
  const rect = frame.value?.getBoundingClientRect();
  if (!rect) return;
  split.value = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100));
}

function onPointerMove(e: PointerEvent) {
  if (e.pointerType !== "mouse" && !frame.value?.hasPointerCapture(e.pointerId)) return;
  following.value = true;
  if (e.pointerType !== "mouse") dragged = true;
  moveTo(e.clientX);
}

function onPointerLeave(e: PointerEvent) {
  if (e.pointerType !== "mouse") return;
  following.value = false;
  split.value = START;
}

// Touch / pen: only the handle starts a drag, so swiping elsewhere still scrolls the page
function onHandleDown(e: PointerEvent) {
  if (e.pointerType === "mouse") return;
  e.preventDefault();
  dragged = false;
  frame.value?.setPointerCapture(e.pointerId);
}

function onPointerUp() {
  following.value = false;
}

// A drag on the handle must not open the story map
function onClick(e: MouseEvent) {
  if (dragged) {
    e.preventDefault();
    dragged = false;
  }
}
</script>

<template>
  <RouterLink
    :to="`/story-map/${storyMap.id}`"
    class="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-heigit-50 shadow-sm transition-all hover:border-heigit-red hover:scale-105"
    @click.capture="onClick"
  >
    <div
      ref="frame"
      class="relative select-none"
      @pointermove="compareSrc && onPointerMove($event)"
      @pointerleave="compareSrc && onPointerLeave($event)"
      @pointerup="onPointerUp"
      @pointercancel="onPointerUp"
    >
      <!-- block: no gap below the image, so the credit sits exactly in its bottom-right corner;
           7:4 keeps the whole (zoomed-out) cyclone image visible -->
      <img
        :src="imageSrc"
        :alt="storyMap.alt"
        draggable="false"
        class="block aspect-[7/4] w-full object-cover"
      />
      <template v-if="compareSrc">
        <img
          :src="compareSrc"
          :alt="storyMap.compareAlt ?? ''"
          draggable="false"
          class="absolute inset-0 h-full w-full object-cover"
          :class="{ 'transition-[clip-path] duration-500 ease-out': !following }"
          :style="{ clipPath: `inset(0 ${100 - split}% 0 0)` }"
        />
        <div
          class="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_4px_rgba(0,0,0,0.5)]"
          :class="{ 'transition-[left] duration-500 ease-out': !following }"
          :style="{ left: `${split}%` }"
        >
          <span
            class="absolute left-1/2 top-1/2 flex h-7 w-7 -translate-x-1/2 -translate-y-1/2 cursor-ew-resize items-center justify-center rounded-full bg-white text-slate-700 shadow"
            style="touch-action: none"
            aria-hidden="true"
            @pointerdown="onHandleDown"
          >
            <v-icon size="18">mdi-arrow-left-right</v-icon>
          </span>
        </div>
        <span
          v-if="storyMap.compareLabel"
          class="absolute left-1.5 top-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] leading-tight text-white transition-opacity"
          :class="{ 'opacity-0': split < 35 }"
        >
          {{ storyMap.compareLabel }}
        </span>
        <span
          v-if="storyMap.imageLabel"
          class="absolute right-1.5 top-1 rounded bg-black/50 px-1.5 py-0.5 text-[10px] leading-tight text-white transition-opacity"
          :class="{ 'opacity-0': split > 65 }"
        >
          {{ storyMap.imageLabel }}
        </span>
      </template>
      <span
        v-if="storyMap.imageCredit"
        class="absolute bottom-1 right-1.5 rounded bg-black/50 px-1.5 py-0.5 text-[10px] leading-tight text-white"
      >
        {{ storyMap.imageCredit }}
      </span>
    </div>
    <div class="flex flex-1 flex-col p-5">
      <h2
        class="font-bold text-slate-900 transition-colors group-hover:text-heigit-red"
      >
        {{ storyMap.title }}
      </h2>
      <p class="mt-2 line-clamp-3 text-sm text-slate-600">
        {{ storyMap.summary }}
      </p>
    </div>
  </RouterLink>
</template>
