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
        <span class="text-lg font-semibold">{{ t('openMap') }}</span>
      </div>
      <div v-if="feature" class="text-lg font-semibold">
        {{ t(feature) }}
      </div>
      <div class="flex gap-4 px-4">
        <UButton
          :icon="isDark ? 'i-lucide-moon' : 'i-lucide-sun'"
          color="neutral"
          variant="ghost"
          @click="isDark = !isDark"
        />

        <USelect v-model="locale" :items="localeItems" :icon="selectedLocaleIcon" :ui="{ placeholder: 'hidden' }" />
      </div>
    </header>

    <div class="flex flex-1 overflow-hidden">
      <aside
        v-show="sidebarOpen"
        class="bg-blue w-64 border-r p-4 overflow-y-auto transition-all duration-300"
      >
        <div class="flex justify-between items-center font-semibold text-lg mb-4">
          <h3>{{ t('mapDisplayOption') }}</h3>
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
            {{ t('bathing') }}
          </li>
          <li
            class="cursor-pointer hover:text-blue-200"
            :class="{ 'font-bold underline': feature === 'busStops' }"
            @click="setFeature('busStops')"
          >
            {{ t('busStops') }}
          </li>
          <li
            class="cursor-pointer hover:text-blue-200"
            :class="{ 'font-bold underline': feature === 'lakeData' }"
            @click="setFeature('lakeData')"
          >
            {{ t('lakeData') }}
          </li>
        </ul>
      </aside>

      <main class="flex-1 relative">
        <MyLeafletMap :water-bodies="bathingWaterData" :bus-stops="busStopsData" :lake-data="lakeData" :feature-display="feature" :selected-lake-date="selectedLakeDate" @marker-click="selectedItem = $event" />
        <div v-if="feature === 'bathing'" class="absolute z-[100] bottom-0 left-1/2 transform -translate-x-1/2 w-full px-6 py-4 bg-white dark:bg-slate-900 bg-opacity-80 dark:bg-opacity-80">
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
            class="custom-slider w-full relative z-10"
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
          <div class="mt-2 text-center text-black dark:text-white font-semibold">
            {{ t('selectedDate') }}: {{ selectedDate }}
          </div>
        </div>
        <div v-if="feature === 'lakeData'" class="absolute z-[100] bottom-0 left-1/2 transform -translate-x-1/2 w-full px-6 py-4 bg-white dark:bg-slate-900 bg-opacity-80 dark:bg-opacity-80">
          <input
            v-model="selectedLakeDateIndex"
            type="range"
            :min="0"
            :max="lakeDateOptions.length - 1"
            class="w-full relative z-10"
          >
          <div class="mt-2 text-center text-black dark:text-white font-semibold">
            {{ t('selectedDate') }}: {{ selectedLakeDate }}
          </div>
        </div>
        <div
          v-if="selectedItem"
          class="absolute bottom-30 left-1/2 transform -translate-x-1/2 bg-white dark:bg-slate-900 text-black dark:text-white p-4 rounded-lg shadow-lg z-[101] w-[90%] max-w-xl"
        >
          <div class="flex justify-between items-center">
            <h2 class="text-lg font-bold text-black dark:text-white">
              {{ selectedItem.bathing.BADEGEWAESSERNAME }}
            </h2>
            <button class="text-black dark:text-white text-xl" @click="selectedItem = null">
              &times;
            </button>
          </div>
          <ul class="mt-2 space-y-1 text-sm text-black dark:text-white">
            <li><strong>{{ t('quality') }}:</strong> {{ selectedItem.classification?.EINSTUFUNG_ODER_VORABBEWERTUNG || 'N/A' }}</li>
            <li><strong>{{ t('category') }}:</strong> {{ selectedItem.measurements?.GEWAESSERKATEGORIE || 'N/A' }}</li>
            <li><strong>{{ t('depth') }}:</strong> {{ selectedItem.measurements?.SICHTTIEFE || 'N/A' }}</li>
            <li><strong>{{ t('seasonal') }}:</strong> {{ selectedItem.seasonal?.SAISONBEGINN }} - {{ selectedItem.seasonal?.SAISONENDE }} {{ selectedItem.seasonal?.GESCHLOSSEN || 'N/A' }} </li>
            <li><strong>{{ t('infrastructure') }}:</strong> {{ selectedItem.infrastructure?.INFRASTRUKTUR || 'N/A' }}</li>
          </ul>
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SelectItem } from '@nuxt/ui';
import type { LakeDepth, MergedData } from '~/composables/useFetchOpenData';
import { computed, ref, watch } from 'vue';
import MyLeafletMap from '~/components/MyLeafletMap.vue';
import { fetchBathData, fetchBusStopData, fetchLakesData } from '~/composables/useFetchOpenData';
// import layout from '/layout.json';

const { t, locale, setLocale } = useI18n();
const colorMode = useColorMode();

const isDark = computed({
  get() {
    return colorMode.value === 'dark';
  },
  set(_isDark) {
    colorMode.preference = _isDark ? 'dark' : 'light';
  },
});

const localeItems = ref([{ value: 'en', icon: 'i-emojione-v1-flag-for-united-kingdom' }, { value: 'de', icon: 'i-emojione-v1-flag-for-germany' }] satisfies SelectItem[]);
const selectedLocaleIcon = computed(() => localeItems.value.find(item => item.value === locale.value)?.icon);

const isSmallScreen = computed(() => {
  return window.innerWidth < 768;
});
const sidebarOpen = ref(true);
const bathingWaterData = ref<MergedData[]>([]);
const busStopsData = ref<GeoJSON.Feature<GeoJSON.Point, unknown>[]>();
const lakeData = ref<GeoJSON.Feature<GeoJSON.Geometry, { WK_NAME: string, lakeDepth: LakeDepth[] }>[]>();
type FeatureType = 'bathing' | 'busStops' | 'lakeData';
const feature = ref<FeatureType | null>(null);
const dateOptions = [
  '2021-02-10',
  '2021-03-01',
  '2021-04-24',
  '2021-05-01',
  '2021-05-05',
  '2021-05-07',
  '2021-05-18',
  '2021-06-16',
  '2021-07-01',
  '2021-07-03',
  '2021-07-17',
  '2021-08-06',
  '2021-08-14',
  '2022-04-01',
  '2022-05-01',
  '2022-06-01',
  '2022-07-01',
  '2022-08-01',
  '2022-09-01',
  '2022-12-01',
  '2023-03-01',
  '2023-06-01',
  '2023-07-01',
  '2023-08-01',
  '2023-10-01',
  '2023-11-01',
  '2024-05-01',
  '2024-06-01',
  '2024-11-01',
  '2025-04-01',
];

const selectedIndex = ref(0);
const selectedDate = ref(dateOptions[selectedIndex.value]);
const selectedItem = ref<MergedData | null>(null);
let globalMinDate: Date | null = null;
let globalMaxDate: Date | null = null;
const selectedLakeDateIndex = ref(0);
const selectedLakeDate = ref('');
const lakeDateOptions = ref<Date[]>([]);

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
}

function setLakeDepth() {
  if (!lakeData.value) {
    return;
  }
  lakeData.value.forEach((feature) => {
    if (Array.isArray(feature.properties.lakeDepth) && feature.properties.lakeDepth.length > 0) {
      const dates = feature.properties.lakeDepth
        .map((entry) => {
          const [datePart] = entry.Zeit.split(' ');
          const parsedDate = new Date(datePart);
          return parsedDate.getTime();
        });
      if (dates.length > 0) {
        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        if (!globalMinDate || minDate < globalMinDate)
          globalMinDate = minDate;
        if (!globalMaxDate || maxDate > globalMaxDate)
          globalMaxDate = maxDate;
      }
    }
  });
  // globalMinDate.setFullYear(globalMinDate.getFullYear() + 1);
  // globalMinDate.setDate(globalMinDate.getDate() + 1);
  // globalMaxDate.setDate(globalMaxDate.getDate() + 1);
  // console.log(globalMinDate,globalMaxDate)
  if (globalMinDate && globalMaxDate) {
    const dates = [];
    const min = new Date(
      globalMinDate.getFullYear(),
      globalMinDate.getMonth(),
      globalMinDate.getDate(),
    );

    const max = new Date(
      globalMaxDate.getFullYear(),
      globalMaxDate.getMonth(),
      globalMaxDate.getDate(),
    );
    const current = new Date(min);
    // eslint-disable-next-line no-unmodified-loop-condition
    while (current <= max) {
      dates.push(new Date(current.getFullYear(), current.getMonth(), current.getDate()));
      current.setDate(current.getDate() + 1);
    }
    lakeDateOptions.value = dates;
    selectedLakeDateIndex.value = dates.length - 1;
  }
  else {
    lakeDateOptions.value = [];
    selectedLakeDateIndex.value = 0;
  }
  selectedLakeDate.value = lakeDateOptions.value[selectedLakeDateIndex.value]?.toLocaleDateString('en-CA') || '';
}
watch(selectedIndex, async (newIndex) => {
  selectedItem.value = null;
  selectedDate.value = dateOptions[newIndex];
  bathingWaterData.value = await fetchBathData(selectedDate.value);
});
watch(selectedLakeDateIndex, async (newIndex) => {
  selectedLakeDate.value = lakeDateOptions.value[newIndex]?.toISOString().split('T')[0] || '';
});
watch(feature, async () => {
  if (feature.value === 'bathing') {
    selectedIndex.value = dateOptions.length - 1;
    bathingWaterData.value = await fetchBathData(selectedDate.value);
  }
  else if (feature.value === 'busStops') {
    busStopsData.value = await fetchBusStopData();
  }
  else if (feature.value === 'lakeData') {
    lakeData.value = await fetchLakesData();
    setLakeDepth();
  }
});
watch(locale, (newLocale) => {
  setLocale(newLocale);
});
</script>

<style>
.relative span {
  white-space: nowrap;
  font-weight: 500;
}

.custom-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 4px;
  background: transparent;
  position: relative;
  z-index: 2;
}

.custom-slider::-webkit-slider-runnable-track {
  height: 4px;
  background: transparent;
  border-radius: 9999px;
}

.custom-slider::-webkit-slider-thumb {
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
  margin-top: -27px;
}

.custom-slider::-moz-range-thumb {
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: white;
  border: 2px solid #0f172b;
  cursor: pointer;
}
</style>
