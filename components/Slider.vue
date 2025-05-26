<template>
  <div class="absolute z-[100] bottom-0 left-1/2 transform -translate-x-1/2 w-full px-6 py-4 bg-slate-900 bg-opacity-80">
    <div class="relative w-full h-2 rounded overflow-hidden">
      <div
        v-for="group in dateGroup"
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
      :value="selectedIndex"
      type="range"
      :min="0"
      :max="dateOptions.length - 1"
      class="custom-slider w-full relative z-10"
      @input="$emit('update:selectedIndex', +$event.target.value)"
    >

    <div class="relative w-full h-5">
      <span
        v-for="group in dateGroup"
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

    <div class="mt-2 text-center text-white font-semibold">
      {{ t('selectedDate') }}: {{ selectedDate }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps([
  'dateGroup',
  'dateOptions',
  'selectedIndex',
  'selectedDate',
  'isSmallScreen',
]);

defineEmits(['update:selectedIndex']);
const { t } = useI18n();
</script>
