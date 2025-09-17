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
      {{ t('noDepthsAvailableMessage') }} <span class="font-semibold">{{ props.selectedItem.properties[props.selectedItem.properties.options.chart_name] || 'this location' }}</span>.
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
  selectedItem: Feature
}>();
const emit = defineEmits<{
  (e: 'close'): void
}>();
const { t } = useI18n();
ChartJS.register(Title, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale);

const chartReady = computed(() => Array.isArray(props.chartData) && props.chartData.length > 0);
const chartTitle = computed(() => props.selectedItem.properties[props.selectedItem.properties.options.chart_name] ? props.selectedItem.properties[props.selectedItem.properties.options.chart_name] : `No recorded depth for ${props.selectedItem.properties[props.selectedItem.properties.options.chart_name]}`);

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
      label: props.selectedItem.properties.options.chart_legend,
      data: values.value,
      borderColor: '#4ade80', // nice green
      backgroundColor: '#4ade80',
      borderWidth: 2,
      tension: 0.3, // smooth line
      pointRadius: 3,
      pointHoverRadius: 5,
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
        text: props.selectedItem.properties.options.y_axis_label,
        color: '#ffffff',
      },
      ticks: {
        color: '#ffffff',
      },
    },
    x: {
      title: {
        display: true,
        text: props.selectedItem.properties.options.x_axis_label,
        color: '#ffffff',
      },
      ticks: {
        color: '#ffffff',
      },
    },
  },
} as ChartOptions<'line'>));
</script>
