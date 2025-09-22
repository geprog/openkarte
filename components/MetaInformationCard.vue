<template>
  <div
    class="absolute inset-0 z-50 flex items-center justify-center bg-black/50"
  >
    <UCard class="relative w-96 max-h-[70vh] p-0">
      <div class="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold m-0">
          Fetched URLs
        </h3>
        <button
          class="text-white text-xl hover:text-red-400"
          @click="closeCard"
        >
          &times;
        </button>
      </div>
      <div class="max-h-[30vh] overflow-y-auto p-4">
        <ul class="list-disc pl-5 space-y-1">
          <li v-for="(url, index) in urls" :key="index">
            <a :href="url" target="_blank" rel="noopener" class="hover:underline">
              {{ url }}
            </a>
          </li>
        </ul>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
const props = defineProps<{
  fileName: string
}>();

const emit = defineEmits(['close']);

const urls = ref<string[]>([]);

watch(() => props.fileName, async (newFile) => {
  if (!newFile)
    return;
  try {
    urls.value = await $fetch<string[]>(
      `/api/fetchOpenData/meta-information?feature=${encodeURIComponent(newFile)}`,
    );
  }
  catch (err) {
    console.error('Failed to fetch URLs', err);
    urls.value = [];
  }
}, { immediate: true });

// Close card and notify parent
function closeCard() {
  emit('close');
}
</script>
