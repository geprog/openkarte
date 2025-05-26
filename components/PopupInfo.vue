<template>
  <div class="absolute bottom-30 left-1/2 transform -translate-x-1/2 bg-white dark:bg-slate-900 text-black dark:text-white p-4 rounded-lg shadow-lg z-[101] w-[90%] max-w-xl">
    <div class="flex justify-between items-center">
      <h2 class="text-lg font-bold text-white">
        {{ selectedItem.properties.BADEGEWAESSERNAME }}
      </h2>
      <button class="absolute top-2 right-2 text-white text-xl hover:text-red-400" @click="emit('close')">
        &times;
      </button>
    </div>
    <ul class="mt-2 space-y-1 text-sm text-white">
      <li><strong>{{ t('quality') }}:</strong> {{ selectedItem.properties?.EINSTUFUNG_ODER_VORABBEWERTUNG || 'N/A' }}</li>
      <li><strong>{{ t('category') }}:</strong> {{ selectedItem.properties?.GEWAESSERKATEGORIE || 'N/A' }}</li>
      <li><strong>{{ t('depth') }}:</strong> {{ selectedItem.properties?.SICHTTIEFE || 'N/A' }} m</li>
      <li><strong>{{ t('seasonal') }}:</strong> {{ selectedItem.properties?.SAISONBEGINN }} - {{ selectedItem.properties?.SAISONENDE }} {{ selectedItem.properties?.GESCHLOSSEN || 'N/A' }}</li>
      <li><strong>{{ t('infrastructure') }}:</strong> {{ selectedItem.properties?.INFRASTRUKTUR || 'N/A' }}</li>
    </ul>
  </div>
</template>

<script setup lang="ts">
import { useI18n } from 'vue-i18n';

defineProps(['selectedItem']);
const emit = defineEmits<{
  (e: 'close'): void
}>();
const { t } = useI18n();
</script>
