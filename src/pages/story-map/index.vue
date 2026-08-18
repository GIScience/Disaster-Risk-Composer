<script setup lang="ts">
import { ref, computed, onMounted } from "vue";
import PageLayout from "@/layout/PageLayout.vue";
import type { StoryMapConfig } from "@/types/story-map";
import StoryMapPreviewCard from "@/components/story-map/StoryMapPreviewCard.vue";
import { cn } from "@/utils/cn";
import { fetchCountries, type Country } from "@/services/dataService";

const modules = import.meta.glob<{ default: StoryMapConfig }>(
  "@/content/story-maps/*.json",
  {
    eager: true,
  },
);

const countries = ref<Country[]>([]);

onMounted(async () => {
  countries.value = await fetchCountries();
});

const noOfCountries = computed(() => countries.value.length);

const storyMaps = Object.entries(modules)
  .map(([path, mod]) => {
    const id = path.split("/").pop()!.replace(".json", "");
    const hero = mod.default.storyMap.hero;
    const category = mod.default.meta.category || "other";
    return {
      id,
      image: hero.image,
      alt: hero.alt,
      title: hero.title,
      summary: hero.subtitle,
      category: category || "other",
    };
  })
  .sort((a, b) => a.title.localeCompare(b.title));

const categories = ["all", "flood", "cyclone"];
const selectedCategory = ref("all");
const searchQuery = ref("");

const filteredStoryMaps = computed(() => {
  let filtered = storyMaps;

  if (selectedCategory.value !== "all") {
    filtered = filtered.filter(
      (map) => map.category === selectedCategory.value,
    );
  }

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter(
      (map) =>
        map.title.toLowerCase().includes(query) ||
        map.summary.toLowerCase().includes(query),
    );
  }

  return filtered;
});

</script>

<template>
  <PageLayout title="Story Maps">
    <!-- Hero Section -->
    <div
      class="relative overflow-hidden min-h-[calc(100vh-60rem)] flex flex-col justify-center items-center"
    >
      <div class="mx-auto max-w-3xl px-4 text-center sm:px-6 sm:py-20 lg:px-8">
        <h1
          class="text-3xl font-extrabold tracking-tight text-slate-900 sm:text-5xl"
        >
          See how humanitarian risk
          <span class="text-heigit-red">comes to life</span>
        </h1>
        <p class="mx-auto mt-4 max-w-2xl text-base text-slate-600 sm:text-lg">
          Interactive walkthroughs of how Disaster Risk Composer(DIRC)
          quantifies humanitarian risk. Explore the data, the methodology, and
          the result.
        </p>
      </div>
    </div>

    <div class="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 mb-12">
      <div
        class="grid grid-cols-1 md:grid-cols-2 gap-6 py-12 border-y border-slate-200"
      >
        <div class="text-center">
          <div class="text-4xl font-bold text-heigit-red">
            {{ storyMaps.length }}
          </div>
          <p class="text-slate-600 mt-2">Interactive Story Maps</p>
        </div>
        <div class="text-center">
          <div class="text-4xl font-bold text-heigit-red">
            {{ noOfCountries }}
          </div>
          <p class="text-slate-600 mt-2">Countries Covered</p>
        </div>
      </div>
    </div>

    <div class="mx-auto max-w-6xl flex items-center gap-4 px-4 sm:px-6 lg:px-8 mb-12">
      <div class="w-1/3">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search story maps by title or description..."
          class="w-full px-4 py-3 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-heigit-red focus:border-transparent transition-colors"
        />
      </div>

      <div class="flex flex-wrap gap-3">
        <button
          v-for="category in categories"
          :key="category"
          @click="selectedCategory = category"
          :class="
            cn(
              'px-4 py-2 rounded-lg font-medium transition-colors',
              selectedCategory === category
                ? 'bg-heigit-red text-white'
                : 'bg-slate-100 text-slate-700 hover:bg-slate-200',
            )
          "
        >
          {{ category.charAt(0).toUpperCase() + category.slice(1) }}
        </button>
      </div>
    </div>

    <div class="mx-auto max-w-6xl px-4 pb-16 sm:px-6 lg:px-8">
      <div v-if="filteredStoryMaps.length > 0">
        <p class="text-sm text-slate-600 mb-6">
          Showing {{ filteredStoryMaps.length }} of {{ storyMaps.length }} story
          maps
        </p>
        <ul
          class="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 list-none"
        >
          <li
            v-for="(storyMap, index) in filteredStoryMaps"
            :key="storyMap.id"
            class="animate-[fade-in_0.5s_ease-out_both]"
            :style="{ animationDelay: `${index * 60}ms` }"
          >
            <StoryMapPreviewCard :storyMap="storyMap" />
          </li>
        </ul>
      </div>
      <div v-else class="text-center py-12">
        <p class="text-slate-600 text-lg">
          No story maps found. Try adjusting your filters or search query.
        </p>
      </div>
    </div>
  </PageLayout>
</template>

<style scoped>
@keyframes fade-in {
  from {
    opacity: 0;
    transform: translateY(12px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
