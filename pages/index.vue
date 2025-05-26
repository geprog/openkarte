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
      <div class="px-4">
        <select v-model="locale" class="rounded py-1">
          <option value="en">
            English
          </option>
          <option value="de">
            Deutsch
          </option>
        </select>
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
            {{ t('bathingWater') }}
          </li>
          <li
            class="cursor-pointer hover:text-blue-200"
            :class="{ 'font-bold underline': feature === 'lakeData' }"
            @click="setFeature('lakeData')"
          >
            {{ t('lakesData') }}
          </li>
        </ul>
      </aside>

      <main class="flex-1 relative">
        <div
          v-if="loading"
          class="absolute inset-0 z-[9999] flex items-center justify-center bg-white/50 backdrop-blur-sm cursor-not-allowed"
        >
          <LoadingSpinner />
        </div>

        <MyLeafletMap :fetched-data="fetchedData" @marker-click="selectedItem = $event" />
        <Slider
          v-if="feature === 'bathing' && dateOptions"
          :date-group="dateGroup"
          :date-options="dateOptions"
          :selected-index="selectedIndex"
          :selected-date="selectedDate"
          :is-small-screen="isSmallScreen"
          @update:selected-index="selectedIndex = $event"
        />
        <PopupInfo
          v-if="selectedItem && feature === 'bathing'"
          :selected-item="selectedItem"
          @close="selectedItem = null"
        />
        <div
          v-if="selectedItem && feature === 'lakeData'"
          class="absolute bottom-40 left-1/2 transform -translate-x-1/2 bg-slate-900 text-black p-4 rounded-lg shadow-lg z-[101] w-[90%] max-w-2xl"
        >
          <LineChart v-if="selectedItem" :chart-data="chartData" :lake-name="lakeName" class="mt-4" @close="selectedItem = null" />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import LoadingSpinner from '@/components/LoadingSpinner.vue';
import { computed, ref, watch } from 'vue';
import LineChart from '~/components/LineChart.vue';
import MyLeafletMap from '~/components/MyLeafletMap.vue';
import PopupInfo from '~/components/PopupInfo.vue';
import Slider from '~/components/Slider.vue';
import { getDateOptions, getDatesGroups } from '~/composables/useSliderDates';

const { t, locale, setLocale } = useI18n();
const isSmallScreen = computed(() => {
  return window.innerWidth < 768;
});
const sidebarOpen = ref(false);
const fetchedData = ref();
const seriesData = ref([]);
type FeatureType = 'bathing' | 'lakeData';
const feature = ref<FeatureType | null>(null);
const selectedIndex = ref(0);
const selectedItem = ref<any | null>(null);
const selectedDate = ref();
let dateOptions: any[];
let dateGroup: any;
let lakeName: string;
const loading = ref(false);

const chartData = computed(() => {
  if (!selectedItem.value?.lakeDepth[0]) {
    lakeName = selectedItem.value.properties.WK_NAME;
    return [];
  }
  lakeName = selectedItem.value.properties.WK_NAME;
  return selectedItem.value.lakeDepth[0].map((entry: any) => ({
    date: entry.Zeit,
    value: entry.wasserstand,
  }));
});

function setFeature(f: FeatureType) {
  feature.value = f;
  sidebarOpen.value = false;
}

watch(selectedIndex, async (newIndex) => {
  selectedItem.value = null;
  selectedDate.value = dateOptions[newIndex];
  fetchedData.value = seriesData.value[newIndex];
});

watch(feature, async () => {
  loading.value = true;
  if (feature.value) {
    const { execute, data: response, status } = useLazyFetch(
      `/api/opendataInputLayer?feature=${encodeURIComponent(feature.value)}`,
      { immediate: false },
    );

    await execute();

    if (status.value !== 'pending') {
      if (feature.value === 'bathing') {
        fetchedData.value = [];
        seriesData.value = [];
        seriesData.value = response.value;
        dateOptions = getDateOptions(seriesData.value);
        dateGroup = getDatesGroups(seriesData.value);
        selectedIndex.value = dateOptions.length - 1;
        selectedDate.value = dateOptions[selectedIndex.value];
      }
      else if (feature.value === 'lakeData') {
        fetchedData.value = [];
        fetchedData.value = response.value;
      }
    }
  }
  loading.value = false;
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
