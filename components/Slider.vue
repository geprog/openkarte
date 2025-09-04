<template>
  <div class="absolute z-[100] bottom-0 left-1/2 transform -translate-x-1/2 w-full px-6 py-4 bg-slate-900 bg-opacity-80">
    <div class="relative w-full h-2 rounded overflow-hidden">
      <div
        v-for="group in props.dateGroup"
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
      :value="props.selectedIndex"
      type="range"
      :min="0"
      :max="props.dateOptions.length - 1"
      class="custom-slider w-full relative z-10"
      @input="emit('update:selectedIndex', +$event.target.value)"
    >

    <div class="relative w-full h-5">
      <span
        v-for="group in props.dateGroup"
        :key="group.year"
        class="absolute text-sm text-white"
        :style="{
          left: `${parseFloat(group.offset) + parseFloat(group.width) / 2}%`,
          transform: 'translateX(-50%)',
          fontSize: props.isSmallScreen ? '0.50rem' : '1rem',
        }"
      >
        {{ group.year }}
      </span>
    </div>

    <div class="mt-2 text-center text-white font-semibold">
      {{ t('selectedDate') }}: {{ props.selectedDate }}
    </div>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const props = defineProps<{
  dateGroup: DateGroup[]
  dateOptions: DateOptions[]
  selectedIndex: number
  selectedDate: string
  isSmallScreen: boolean
}>();

const emit = defineEmits<{
  (e: 'update:selectedIndex', value: number): void
}>();

const { t } = useI18n();
</script>
