<template>
  <div
    class="absolute bottom-30 left-1/2 transform -translate-x-1/2 bg-white dark:bg-slate-900 text-black dark:text-white p-4 rounded-lg shadow-lg z-[101] w-[90%] max-w-xl"
  >
    <div class="relative">
      <p v-if="title" class="pr-10 text-sm md:text-xl lg:text-2xl font-bold text-white text-center">
        {{ title }}
      </p>
      <button
        class="absolute top-0 right-0 text-white text-xl hover:text-red-400"
        @click="handleClose"
      >
        &times;
      </button>
    </div>
    <ul class="mt-2 space-y-1 text-sm text-white">
      <li v-for="(detail, index) in popupDetails" :key="index">
        <strong>{{ detail.label }}: </strong>
        <template v-if="Array.isArray(detail.prop)">
          {{ detail.prop
            .map((opt: string) => properties[opt] || 'N/A')
            .join(' - ')
          }}
        </template>
        <template v-else>
          {{ properties[detail.prop] || 'N/A' }}
        </template>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  selectedItem: GeoJSON.Feature
}>();

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'markerReset'): void
}>();

function handleClose() {
  emit('close');
  emit('markerReset');
};

const properties = computed(() => {
  return props.selectedItem.properties || {};
});

const title = computed(() => {
  if (!properties.value.options) {
    return '';
  }
  return properties.value[properties.value.options.popup_name];
});

const popupDetails = computed(() => {
  if (!properties.value.options) {
    return [];
  }
  return (properties.value.options as Options).popup_details || [];
});
</script>
