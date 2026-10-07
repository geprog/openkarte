<template>
  <div>
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
  // Both fields are looked up in the published data by a column name that comes
  // from the layer config, so either can be missing when a publisher renames a
  // column.
  chartData: { date?: string, value?: string }[]
  selectedItem: GeoJSON.Feature
}>();
const emit = defineEmits<{
  (e: 'close'): void
}>();
ChartJS.register(Title, Tooltip, Legend, LineElement, PointElement, LinearScale);

const properties = computed(() => {
  return props.selectedItem.properties || {};
});

const chartTitle = computed(() => properties.value[properties.value.options.chart_name]);

// Gauges publish local timestamps without a zone ("1996-11-07 01:00:00").
// Reading and formatting them as UTC keeps the dates as published.
function toTimestamp(date: string | undefined): number {
  return date ? Date.parse(`${date.replace(' ', 'T')}Z`) : Number.NaN;
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toISOString().split('T')[0]!;
}

const MAX_YEAR_TICKS = 10;

/**
 * Ticks on 1 January for series spanning a few years, as a linear axis would
 * otherwise put them on round millisecond values, i.e. arbitrary dates.
 * Returns undefined for shorter series, which keep the default ticks.
 */
function yearTicks(min: number, max: number): { value: number }[] | undefined {
  const firstYear = new Date(min).getUTCFullYear() + 1;
  const lastYear = new Date(max).getUTCFullYear();
  if (lastYear - firstYear < 2) {
    return undefined;
  }
  const step = Math.ceil((lastYear - firstYear + 1) / MAX_YEAR_TICKS);
  const ticks = [];
  for (let year = firstYear; year <= lastYear; year += step) {
    ticks.push({ value: Date.UTC(year, 0, 1) });
  }
  return ticks;
}

// Points sit on a time-proportional axis: a gauge that switched from hourly to
// monthly readings would otherwise squeeze the monthly years into a sliver at
// the end. A reading without a usable date cannot be placed and is dropped.
const points = computed(() =>
  props.chartData
    .map(d => ({
      x: toTimestamp(d.date),
      // Converts the published unit to the one on the axis, e.g. 100 for cm → m.
      y: Number(d.value) / (properties.value.options.y_axis_divisor ?? 1),
    }))
    .filter(p => !Number.isNaN(p.x))
    .sort((a, b) => a.x - b.x),
);

const data = computed(() => ({
  datasets: [
    {
      label: properties.value.options.chart_legend,
      data: points.value,
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
    tooltip: {
      callbacks: {
        title: items => items[0] ? formatDate(items[0].parsed.x!) : '',
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
      type: 'linear',
      min: points.value[0]?.x,
      max: points.value.at(-1)?.x,
      title: {
        display: true,
        text: properties.value.options.x_axis_label,
      },
      afterBuildTicks: (axis) => {
        const ticks = yearTicks(axis.min, axis.max);
        if (ticks) {
          axis.ticks = ticks;
        }
      },
      ticks: {
        callback: (value) => {
          const date = formatDate(Number(value));
          return date.endsWith('-01-01') ? date.slice(0, 4) : date;
        },
      },
    },
  },
} as ChartOptions<'line'>));
</script>
