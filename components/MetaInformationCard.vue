<template>
  <div
    class="absolute inset-0 z-50 flex items-center justify-center bg-black/50"
  >
    <UCard class="relative w-1/2 max-h-[70vh] p-0">
      <div class="flex items-center justify-between p-4 border-b border-gray-200">
        <h3 class="text-lg font-semibold m-0">
          {{ t('datasetDetail') }}
        </h3>
        <button
          class="text-xl hover:text-red-400"
          @click="closeCard"
        >
          &times;
        </button>
      </div>
      <div class="max-h-[50vh] overflow-y-auto divide-y divide-gray-200">
        <div
          v-if="urls.length <= 0"
          class="absolute inset-0 z-[9999] flex items-center justify-center bg-white/50 backdrop-blur-sm cursor-not-allowed"
        >
          <LoadingSpinner />
        </div>
        <div
          v-for="(item, index) in urls"
          v-else
          :key="index"
          class="p-4 space-y-2"
        >
          <p>
            <span class="font-semibold">{{ t('organization') }}:</span>
            {{ item.organization?.title || 'N/A' }}
          </p>
          <p>
            <span class="font-semibold">{{ t('license') }}:</span>
            <a
              v-if="item.license_url"
              :href="item.license_url"
              target="_blank"
              rel="noopener"
              class="text-blue-600 hover:underline"
            >
              {{ item.license_title }}
            </a>
            <span v-else>{{ item.license_title || 'N/A' }}</span>
          </p>
          <p>
            <span class="font-semibold">{{ t('datasetUrl') }}:</span>
            <a
              :href="item.url"
              target="_blank"
              rel="noopener"
              class="text-blue-600 hover:underline"
            >
              {{ item.url }}
            </a>
          </p>
        </div>
      </div>
    </UCard>
  </div>
</template>

<script setup lang="ts">
import LoadingSpinner from './LoadingSpinner.vue';

const props = defineProps<{
  fileName: string
}>();

const emit = defineEmits(['close']);
const { t } = useI18n();

const urls = ref<UrlInfo[]>([]);

watch(() => props.fileName, async (newFile) => {
  if (!newFile)
    return;
  try {
    urls.value = await $fetch<UrlInfo[]>(
      `/api/fetchOpenData/meta-information?feature=${encodeURIComponent(newFile)}`,
    );
  }
  catch (err) {
    console.error('Failed to fetch URLs', err);
    urls.value = [];
  }
}, { immediate: true });

function closeCard() {
  emit('close');
}
</script>
