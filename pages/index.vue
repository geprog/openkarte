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
        {{ featureOptions.find((opt: MapDisplayOptions) => opt.name === feature)?.title }}
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
            v-for="opt in featureOptions"
            :key="opt.name"
            class="cursor-pointer hover:text-blue-200"
            :class="{ 'font-bold underline': feature === opt.name }"
            @click="setFeature(opt.name)"
          >
            {{ opt.title }}
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

        <MyLeafletMap ref="leafletMapRef" :fetched-data="fetchedData" @marker-click="selectedItem = $event" />
        <Slider
          v-if="hasSlider && dateOptions"
          :date-group="dateGroup"
          :date-options="dateOptions"
          :selected-index="selectedIndex"
          :selected-date="selectedDate"
          :is-small-screen="isSmallScreen"
          @update:selected-index="selectedIndex = $event"
        />
        <PopupInfo
          v-if="selectedItem?.properties.options.display_option === 'popup'"
          :selected-item="selectedItem"
          @close="selectedItem = null"
          @marker-reset="onMarkerReset"
        />
        <div
          v-if="selectedItem?.properties.options.display_option === 'line chart'"
          class="absolute bottom-40 left-1/2 transform -translate-x-1/2 bg-slate-900 text-black p-4 rounded-lg shadow-lg z-[101] w-[90%] max-w-2xl"
        >
          <LineChart v-if="selectedItem" :chart-data="chartData" :selected-item="selectedItem" class="mt-4" @close="selectedItem = null" />
        </div>
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { SelectItem } from '@nuxt/ui';
import LoadingSpinner from '@/components/LoadingSpinner.vue';
import { computed, ref, watch } from 'vue';
import LineChart from '~/components/LineChart.vue';
import MyLeafletMap from '~/components/MyLeafletMap.vue';
import PopupInfo from '~/components/PopupInfo.vue';
import Slider from '~/components/Slider.vue';
import { getDateOptions, getDatesGroups } from '~/composables/useSliderDates';
import featureOptionsJson from '~/data/mapDisplayOptions.json';

const featureOptions = featureOptionsJson.options;

const leafletMapRef = ref<InstanceType<typeof MyLeafletMap> | null>(null);
const { t, locale, setLocale } = useI18n();
const isSmallScreen = computed(() => {
  return window.innerWidth < 768;
});
const sidebarOpen = ref(false);
const fetchedData = ref();
const seriesData = ref<FeatureCollection[]>([]);
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

const feature = ref<string | null>(null);
const selectedIndex = ref(0);
const selectedItem = ref<Feature | null>(null);
const selectedDate = ref();
let dateOptions: DateOptions[];
let dateGroup: DateGroup[];
const loading = ref(false);
const hasSlider = ref(false);

const chartData = computed(() => {
  const data = selectedItem.value;
  if (!data || !data.properties.match?.[0]) {
    return [];
  }
  const series = data.properties.match[0];
  return series.map((entry: DataEntry) => ({
    date: entry[data.properties.options.x_axis_data],
    value: entry[data.properties.options.y_axis_data],
  }));
});

function setFeature(f: string) {
  feature.value = f;
}

watch(selectedIndex, (newIndex) => {
  selectedItem.value = null;
  selectedDate.value = dateOptions[newIndex];
  fetchedData.value = seriesData.value[newIndex];
});

function onMarkerReset() {
  leafletMapRef.value?.resetSelectedMarker();
}

watch(feature, async () => {
  loading.value = true;
  if (feature.value) {
    const { execute, data: response, status } = useLazyFetch(
      `/api/fetchOpenData?feature=${encodeURIComponent(feature.value)}`,
      { immediate: false },
    );

    await execute();

    if (status.value !== 'pending' && response.value) {
      const resp = response.value as NormalizedResponse;
      console.log('resp', resp);
      hasSlider.value = (resp.datasets as FeatureCollection[]).flat().some(item => item.features[0]?.properties.options?.slider?.toLowerCase() === 'yes');

      if (hasSlider.value) {
        fetchedData.value = [];
        seriesData.value = [];
        seriesData.value = resp.datasets;
        dateOptions = getDateOptions(seriesData.value);
        dateGroup = getDatesGroups(seriesData.value);
        selectedIndex.value = dateOptions.length - 1;
        selectedDate.value = dateOptions[selectedIndex.value];
      }
      else {
        fetchedData.value = [];
        fetchedData.value = resp.datasets[0];
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
