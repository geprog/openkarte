<template>
  <div
    class="absolute z-[100] bottom-0 left-1/2 transform -translate-x-1/2 w-full px-6 py-4 bg-slate-900 bg-opacity-80"
  >
    <div class="relative w-full h-2 rounded overflow-hidden">
      <div
        v-for="group in groupedDates" :key="group.year" class="absolute h-full" :style="{
          left: `${group.offset}%`,
          width: `${group.width}%`,
          backgroundColor: group.color,
        }"
      />
    </div>

    <div class="-mt-[17px]">
      <input
        v-model.number="modelValue" type="range" :min="0" :max="dateOptions.length - 1"
        class="custom-slider w-full relative z-10"
      >
    </div>

    <div class="relative w-full h-5 mt-2">
      <span
        v-for="group in groupedDates" :key="group.year" class="absolute text-sm text-white whitespace-nowrap font-medium" :style="{
          left: `${parseFloat(group.offset) + parseFloat(group.width) / 2}%`,
          transform: 'translateX(-50%)',
          fontSize: isSmallScreen ? '0.50rem' : '1rem',
        }"
      >
        {{ group.year }}
      </span>
    </div>

    <div class="mt-2 text-center text-white font-semibold">
      {{ t('selectedDate') }}: {{ selectedDate }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  dateOptions: string[]
  isSmallScreen: boolean
}>();

const modelValue = defineModel<number>({ required: true });

const selectedDate = computed(() => {
  if (props.dateOptions && props.dateOptions.length > 0) {
    return props.dateOptions[modelValue.value];
  }
  return '';
});

const groupedDates = computed(() => {
  return getDatesGroups(props.dateOptions);
});

const { t } = useI18n();
</script>

<style scoped>
.custom-slider {
  -webkit-appearance: none;
  appearance: none;
  width: 100%;
  height: 8px;
  background: transparent;
  position: relative;
  z-index: 2;
  cursor: pointer;
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
  margin-top: -8px;
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
