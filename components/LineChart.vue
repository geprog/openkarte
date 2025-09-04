<template>
  <div class="relative bg-slate-900 p-4 rounded-lg shadow-lg text-white">
    <!-- Close button -->
    <button
      class="absolute top-2 right-2 text-white text-xl hover:text-red-400"
      @click="emit('close')"
    >
      &times;
    </button>

    <div v-if="chartReady">
      <Line :data="data" :options="options" />
    </div>
    <div v-else class="text-white text-center py-4">
      {{ t('noDepthsAvailableMessage') }} <span class="font-semibold">{{ props.lakeName || 'this location' }}</span>.
    </div>
  </div>
</template>

<script setup lang="ts">
import type { ChartOptions } from 'chart.js';
import {
  CategoryScale,
  Chart as ChartJS,
  Legend,
  LinearScale,
  LineElement,
  PointElement,
  Title,
  Tooltip,
} from 'chart.js';
import { computed } from 'vue';
import { Line } from 'vue-chartjs';

const props = defineProps<{
  chartData: { date: string, value: string }[]
  lakeName?: string
}>();
const emit = defineEmits<{
  (e: 'close'): void
}>();
const { t } = useI18n();
ChartJS.register(Title, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale);

const chartReady = computed(() => Array.isArray(props.chartData) && props.chartData.length > 0);
const chartTitle = computed(() => props.lakeName ? `${t('depthFor')} ${props.lakeName}` : `No recorded depth for ${props.lakeName}`);

const labels = computed(() =>
  props.chartData.map(d => d.date.split(' ')[0]),
);

const values = computed(() =>
  props.chartData.map(d => Number(d.value)),
);

const data = computed(() => ({
  labels: labels.value,
  datasets: [
    {
      label: t('depthOverTime'),
      data: values.value,
      backgroundColor: '#ffffff',
      borderWidth: -0.5,
      pointRadius: 2,
    },
  ],
}));

const options = computed(() => ({
  responsive: true,
  plugins: {
    title: {
      display: true,
      text: chartTitle.value,
      color: '#ffffff',
      font: {
        size: 18,
        weight: 'bold' as const,
      },
    },
  },
  scales: {
    y: {
      title: {
        display: true,
        text: t('depthInMeter'),
        color: '#ffffff',
      },
      ticks: {
        color: '#ffffff',
      },
    },
    x: {
      title: {
        display: true,
        text: t('date'),
        color: '#ffffff',
      },
      ticks: {
        color: '#ffffff',
      },
    },
  },
} as ChartOptions<'line'>));
</script>
