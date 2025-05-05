<!-- pages/index.vue or layout.vue -->
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
      </div>
    </header>

    <div class="flex flex-1 overflow-hidden">
      <aside
        v-show="sidebarOpen"
        class="bg-blue w-64 border-r p-4 overflow-y-auto transition-all duration-300"
      >
        <h3 class="font-semibold text-lg mb-4">
          Map Display Options
        </h3>
        <ul class="space-y-2">
          <li class="cursor-pointer hover:text-blue-600" @click="fetchBathingQualityData">
            Bathing Water Quality
          </li>
          <li class="cursor-pointer hover:text-blue-600" @click="fetchBathingCatagoryData">
            Bathing Water Catagory
          </li>
          <li class="cursor-pointer hover:text-blue-600" @click="fetchBathingDepthData">
            Bathing Water Depth
          </li>
          <li class="cursor-pointer hover:text-blue-600" @click="fetchBathingSeasonalData">
            Bathing Water Seasonal Status
          </li>
          <li class="cursor-pointer hover:text-blue-600" @click="fetchBathingInfrastructureData">
            Bathing Water Infrastructure
          </li>
        </ul>
      </aside>

      <main class="flex-1 relative z-10">
        <MyLeafletMap :water-bodies="bathingWaterData" :feature-display="feature" />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { MergedData } from '~/components/FetchOpenData';
import { ref } from 'vue';
import { fetchData } from '~/components/FetchOpenData';
import MyLeafletMap from '~/components/MyLeafletMap.vue';

const sidebarOpen = ref(false);
const bathingWaterData = ref<MergedData[]>([]);
const feature = ref('');

async function fetchBathingQualityData() {
  feature.value = 'quality';
}
async function fetchBathingCatagoryData() {
  feature.value = 'catagory';
}
async function fetchBathingDepthData() {
  feature.value = 'depth';
}
async function fetchBathingSeasonalData() {
  feature.value = 'seasonal';
}
async function fetchBathingInfrastructureData() {
  feature.value = 'infrastructure';
}

onMounted(async () => {
  bathingWaterData.value = await fetchData();
});
</script>
