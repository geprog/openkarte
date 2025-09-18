<template>
  <div
    class="absolute bottom-30 left-1/2 transform -translate-x-1/2 bg-white dark:bg-slate-900 text-black dark:text-white p-4 rounded-lg shadow-lg z-[101] w-[90%] max-w-xl"
  >
    <div class="relative">
      <h2 class="text-lg font-bold text-white text-center">
        {{ props.selectedItem.properties[props.selectedItem.properties.options.popup_name] }}
      </h2>
      <button
        class="absolute top-0 right-0 text-white text-xl hover:text-red-400"
        @click="handleClose"
      >
        &times;
      </button>
    </div>
    <ul class="mt-2 space-y-1 text-sm text-white">
      <li v-for="(detail, index) in props.selectedItem.properties.options.pop_details" :key="index">
        <strong>{{ detail.label }}:</strong>
        <template v-if="Array.isArray(detail.prop)">
          {{ detail.prop
            .map((opt: prop) => props.selectedItem.properties?.[opt.option] || 'N/A')
            .join(' - ')
          }}
        </template>
        <template v-else>
          {{ props.selectedItem.properties?.[detail.prop] || 'N/A' }}
        </template>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  selectedItem: Feature
}>();

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'markerReset'): void
}>();

function handleClose() {
  emit('close');
  emit('markerReset');
};
</script>
