<template>
  <div class="relative p-4 rounded-lg shadow-lg">
    <!-- Close button -->
    <button
      class="absolute top-2 right-2 text-xl hover:text-red-400"
      @click="emit('close')"
    >
      &times;
    </button>

    <div class="w-full" style="height: 300px; max-height: 50vh;">
      <Line :data="data" :options="options" />
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
  selectedItem: GeoJSON.Feature
}>();
const emit = defineEmits<{
  (e: 'close'): void
}>();
ChartJS.register(Title, Tooltip, Legend, LineElement, PointElement, CategoryScale, LinearScale);

const properties = computed(() => {
  return props.selectedItem.properties || {};
});

const chartTitle = computed(() => properties.value[properties.value.options.chart_name]);

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
      label: properties.value.options.chart_legend,
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
  maintainAspectRatio: false,
  plugins: {
    title: {
      display: true,
      text: chartTitle.value,
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
        text: properties.value.options.y_axis_label,
      },
    },
    x: {
      title: {
        display: true,
        text: properties.value.options.x_axis_label,
      },
    },
  },
} as ChartOptions<'line'>));
</script>
