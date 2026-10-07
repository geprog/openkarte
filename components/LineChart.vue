<template>
  <div>
    <!-- Close button -->
    <button
      class="absolute top-2 right-2 text-xl hover:text-red-400"
      @click="emit('close')"
    >
      &times;
    </button>

    <p class="pr-8 text-lg font-bold text-center">
      {{ chartTitle }}
    </p>

    <!-- What the lake's color on the map is based on, for the selected month -->
    <dl v-if="selectedStats" class="mt-2 grid grid-cols-3 gap-2 text-center text-sm">
      <div>
        <dt class="text-gray-500 dark:text-gray-400">
          {{ t('levelInMonth', { month: selectedStats.monthName }) }}
        </dt>
        <dd class="font-semibold">
          {{ selectedStats.level }}
        </dd>
      </div>
      <div>
        <dt class="text-gray-500 dark:text-gray-400">
          {{ t('longTermMean', { month: selectedStats.calendarMonthName }) }}
        </dt>
        <dd class="font-semibold">
          {{ selectedStats.mean ?? (selectedStats.excluded ? t('notCompared') : t('notEnoughHistory')) }}
        </dd>
      </div>
      <div>
        <dt class="text-gray-500 dark:text-gray-400">
          {{ t('deviation') }}
        </dt>
        <dd class="font-semibold">
          {{ selectedStats.deviation ?? '–' }}
        </dd>
      </div>
    </dl>

    <div class="w-full mt-2" style="height: 300px; max-height: 50vh;">
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
  // One entry per month ("2024-05"), as condensed by the server.
  chartData: { month: string, value: number }[]
  selectedItem: GeoJSON.Feature
  // Month picked on the slider, highlighted on the line.
  selectedDate?: string
}>();
const emit = defineEmits<{
  (e: 'close'): void
}>();
ChartJS.register(Title, Tooltip, Legend, LineElement, PointElement, LinearScale);

const properties = computed(() => {
  return props.selectedItem.properties || {};
});

const chartTitle = computed(() => properties.value[properties.value.options.chart_name]);

// Months are placed and formatted in UTC, so no time zone shifts them.
function toTimestamp(month: string): number {
  const [year, monthOfYear] = month.split('-').map(Number);
  return Date.UTC(year!, monthOfYear! - 1, 1);
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

// Points sit on a time-proportional axis, so gaps in a gauge's record show as
// gaps rather than being squeezed out.
const points = computed(() =>
  props.chartData
    .map(d => ({
      x: toTimestamp(d.month),
      // Converts the published unit to the one on the axis, e.g. 100 for cm → m.
      y: d.value / (properties.value.options.y_axis_divisor ?? 1),
    }))
    .sort((a, b) => a.x - b.x),
);

const selectedPoint = computed(() => {
  const x = props.selectedDate ? toTimestamp(props.selectedDate) : undefined;
  return points.value.filter(p => p.x === x);
});

const { t, locale } = useI18n();

function formatNumber(value: number, unit: string | undefined, { fractionDigits = 0, signed = false } = {}): string {
  const number = value.toLocaleString(locale.value, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
    signDisplay: signed ? 'exceptZero' : 'auto',
  });
  return unit ? `${number} ${unit}` : number;
}

// Level, long-term mean of the same calendar month and the deviation between
// them, i.e. the numbers behind the lake's color for the selected month.
const selectedStats = computed(() => {
  const month = props.selectedDate;
  const entry: [number, number | null] | undefined = month ? properties.value.timeline?.[month] : undefined;
  if (!month || !entry) {
    return undefined;
  }
  const [level, deviation] = entry;
  const options = properties.value.options;
  const divisor = options.y_axis_divisor ?? 1;
  const date = new Date(toTimestamp(month));
  return {
    // e.g. a gauge's placeholder zeros, which are shown but never compared
    excluded: (options.excluded_from_mean ?? []).includes(level),
    monthName: date.toLocaleDateString(locale.value, { month: 'long', year: 'numeric', timeZone: 'UTC' }),
    calendarMonthName: date.toLocaleDateString(locale.value, { month: 'long', timeZone: 'UTC' }),
    level: formatNumber(level / divisor, options.y_axis_unit, { fractionDigits: 2 }),
    mean: deviation === null ? undefined : formatNumber((level - deviation) / divisor, options.y_axis_unit, { fractionDigits: 2 }),
    deviation: deviation === null ? undefined : formatNumber(deviation, options.value_unit, { signed: true }),
  };
});

const data = computed(() => ({
  datasets: [
    {
      label: properties.value.options.chart_legend,
      data: points.value,
      borderColor: '#4ade80', // nice green
      backgroundColor: '#4ade80',
      borderWidth: 2,
      tension: 0.3, // smooth line
      pointRadius: 0,
      pointHitRadius: 6,
      pointHoverRadius: 4,
    },
    {
      label: t('selectedDate'),
      data: selectedPoint.value,
      borderColor: '#0f172b',
      backgroundColor: '#0f172b',
      pointRadius: 6,
      pointHoverRadius: 7,
      showLine: false,
    },
  ],
}));

const options = computed(() => ({
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
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
