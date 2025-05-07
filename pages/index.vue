<template>
  <div class="h-screen w-screen flex flex-col">
    <header class="bg-blue shadow flex items-center justify-between">
      <div class="flex items-center space-x-2">
        <button
          class="p-2 bg-blue rounded hover:bg-blue-600 flex items-center space-x-2"
          @click="sidebarOpen = !sidebarOpen"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg" class="h-6 w-6" fill="none"
            viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"
          >
            <path
              stroke-linecap="round" stroke-linejoin="round"
              d="M4 6h16M4 12h16M4 18h16"
            />
          </svg>
        </button>
        <span class="text-lg font-semibold">Open Karte</span>
      </div>
    </header>

    <div class="flex flex-1 overflow-hidden">
      <aside
        v-show="sidebarOpen"
        class="bg-blue w-64 border-r p-4 overflow-y-auto transition-all duration-300"
      >
        <div class="flex justify-between items-center font-semibold text-lg mb-4">
          <h3>Map Display Options</h3>
          <button class="text-lg" @click="sidebarOpen = false">
            &times;
          </button>
        </div>
        <ul class="space-y-2">
          <li
            class="cursor-pointer hover:text-blue-200"
            :class="{ 'font-bold underline': feature === 'bathing' }"
            @click="setFeature('bathing')"
          >
            Bathing Water Data
          </li>
          <li
            class="cursor-pointer hover:text-blue-200"
            :class="{ 'font-bold underline': feature === 'busStops' }"
            @click="setFeature('busStops')"
          >
            Traffic Data
          </li>
        </ul>
      </aside>

      <main class="flex-1 relative">
        <MyLeafletMap :water-bodies="bathingWaterData" :bus-stops="busStopsData" :feature-display="feature" @marker-click="selectedItem = $event" />
        <div v-if="feature === 'bathing'" class="absolute z-[100] bottom-0 left-1/2 transform -translate-x-1/2 w-full px-6 py-4 bg-slate-900 bg-opacity-80">
          <div class="relative w-full h-2 rounded overflow-hidden">
            <div
              v-for="(group) in groupedDates"
              :key="group.year"
              class="absolute h-full"
              :style="{
                left: `${group.offset}%`,
                width: `${group.width}%`,
                backgroundColor: group.color,
              }"
            />
          </div>
          <input
            v-model="selectedIndex"
            type="range"
            :min="0"
            :max="dateOptions.length - 1"
            class="w-full relative z-10 appearance-none"
          >
          <div class="relative w-full h-5">
            <span
              v-for="group in groupedDates"
              :key="group.year"
              class="absolute text-sm text-white"
              :style="{
                left: `${parseFloat(group.offset) + parseFloat(group.width) / 2}%`,
                transform: 'translateX(-50%)',
                fontSize: isSmallScreen ? '0.50rem' : '1rem',
              }"
            >
              {{ group.year }}
            </span>
          </div>
          <div class="mt-2 text-center text-white font-semibold">
            Selected Date: {{ selectedDate }}
          </div>
        </div>
        <div
          v-if="selectedItem"
          class="absolute bottom-29 left-1/2 transform -translate-x-1/2 bg-slate-900 text-black p-4 rounded-lg shadow-lg z-[101] w-[90%] max-w-xl"
        >
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-bold text-white">
              {{ selectedItem.bathing.BADEGEWAESSERNAME }}
            </h2>
            <button class="text-white text-xl" @click="selectedItem = null">
              &times;
            </button>
          </div>
          <ul class="mt-2 space-y-1 text-sm text-white">
            <li><strong>Quality:</strong> {{ selectedItem.classification?.EINSTUFUNG_ODER_VORABBEWERTUNG || 'N/A' }}</li>
            <li><strong>Category:</strong> {{ selectedItem.measurements?.GEWAESSERKATEGORIE || 'N/A' }}</li>
            <li><strong>Depth:</strong> {{ selectedItem.measurements?.SICHTTIEFE || 'N/A' }}</li>
            <li><strong>Seasonal:</strong> {{ selectedItem.seasonal?.GESCHLOSSEN || 'N/A' }}</li>
            <li><strong>Infrastructure:</strong> {{ selectedItem.infrastructure?.INFRASTRUKTUR || 'N/A' }}</li>
          </ul>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MergedData } from '~/components/FetchOpenData';
import { computed, ref, watch } from 'vue';
import { fetchBathData, fetchBusStopData } from '~/components/FetchOpenData';
import MyLeafletMap from '~/components/MyLeafletMap.vue';

const isSmallScreen = computed(() => {
  return window.innerWidth < 768;
});
const sidebarOpen = ref(false);
const bathingWaterData = ref<MergedData[]>([]);
const busStopsData = ref();
type FeatureType = 'bathing' | 'busStops';
const feature = ref<FeatureType | null>(null);

const dateOptions = [
  '2025-04-01',
  '2024-11-01',
  '2024-06-01',
  '2024-05-01',
  '2023-11-01',
  '2023-10-01',
  '2023-08-01',
  '2023-07-01',
  '2023-06-01',
  '2023-03-01',
  '2022-12-01',
  '2022-09-01',
  '2022-08-01',
  '2022-07-01',
  '2022-06-01',
  '2022-05-01',
  '2022-04-01',
  '2021-08-14',
  '2021-08-06',
  '2021-07-17',
  '2021-07-03',
  '2021-07-01',
  '2021-06-16',
  '2021-05-18',
  '2021-05-07',
  '2021-05-05',
  '2021-05-01',
  '2021-04-24',
  '2021-03-01',
  '2021-02-10',
];

const selectedIndex = ref(0);
const selectedDate = ref(dateOptions[selectedIndex.value]);
const selectedItem = ref<MergedData | null>(null);

const yearColors = ['#3B82F6', '#10B981', '#8B5CF6', '#F59E0B', '#EF4444'];

const groupedDates = computed(() => {
  const yearGroups = new Map<string, string[]>();

  dateOptions.forEach((date) => {
    const year = date.slice(0, 4);
    if (!yearGroups.has(year)) {
      yearGroups.set(year, []);
    }
    yearGroups.get(year)!.push(date);
  });

  const total = dateOptions.length;
  let offset = 0;

  return Array.from(yearGroups.entries()).map(([year, dates], i) => {
    const width = (dates.length / total) * 100;
    const group = {
      year,
      width: width.toFixed(2),
      offset: offset.toFixed(2),
      color: yearColors[i % yearColors.length],
    };
    offset += width;
    return group;
  });
});

function setFeature(f: FeatureType) {
  feature.value = f;
  sidebarOpen.value = false;
}
watch(selectedIndex, async (newIndex) => {
  selectedItem.value = null;
  selectedDate.value = dateOptions[newIndex];
  bathingWaterData.value = await fetchBathData(selectedDate);
});
watch(feature, async () => {
  if (feature.value === 'bathing') {
    bathingWaterData.value = await fetchBathData(selectedDate);
  }
  else if (feature.value === 'busStops') {
    busStopsData.value = await fetchBusStopData();
  }
});
</script>

<style>
.relative span {
  white-space: nowrap;
  font-weight: 500;
}
/* Ensure the slider thumb and track are visible and styled correctly */
input[type='range'] {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  background: transparent;
  position: relative;
  z-index: 2;
}
/* For Webkit-based browsers like Chrome and Safari */
input[type='range']::-webkit-slider-runnable-track {
  height: 4px;
  background: transparent;
  border-radius: 9999px;
}
input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  border: 2px solid #0f172b;
  cursor: pointer;
  position: relative;
  z-index: 10;
  margin-top: -27px; /* Push thumb up above the track */
}
/* For Firefox */
input[type='range']::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  border: 2px solid #0f172b;
  cursor: pointer;
}
</style>
