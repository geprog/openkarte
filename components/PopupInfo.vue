<template>
  <div
    class="absolute bottom-30 left-1/2 transform -translate-x-1/2 bg-white dark:bg-slate-900 text-black dark:text-white p-4 rounded-lg shadow-lg z-[101] w-[90%] max-w-xl"
  >
    <div class="flex justify-between items-center">
      <h2 class="text-lg font-bold text-white">
        {{ selectedItem.properties[popupConfig.titleProp] }}
      </h2>
      <button
        class="absolute top-2 right-2 text-white text-xl hover:text-red-400"
        @click="handleClose"
      >
        &times;
      </button>
    </div>
    <ul class="mt-2 space-y-1 text-sm text-white">
      <li
        v-for="(detail, index) in popupConfig.details" :key="index">
        <strong>{{ t(detail.label) }}:</strong>
        {{ detail.formatter ? detail.formatter(selectedItem.properties[detail.prop], selectedItem) : (selectedItem.properties?.[detail.prop] || 'N/A') }}
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

type PopupConfig = {
  titleProp: string;
  details?: {
    label: string;
    prop: string;
    formatter?: (value: any, selectedItem?: any) => string; // optional for custom logic
  }[];
};

defineProps<{
  selectedItem: any;
  popupConfig: PopupConfig;
}>();

const emit = defineEmits<{
  (e: 'close'): void;           // for hiding the popup
  (e: 'marker-reset'): void;    // for resetting the highlighted marker
}>();

function handleClose() {
  emit('close');        // hide the popup
  emit('marker-reset'); // reset the marker style
}
</script>
