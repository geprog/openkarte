<template>
  <UModal v-model:open="showModal" persistent>
    <template #content>
      <UCard class="w-full max-w-lg mx-auto max-h-[70vh]">
        <div class="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 class="text-lg font-semibold m-0">
            {{ t('datasetDetail') }}
          </h3>
          <UButton size="md" variant="text" class="text-white text-xl hover:text-red-400" @click="closeCard">
            &times;
          </UButton>
        </div>
        <div class="relative max-h-[50vh]">
          <div
            v-if="loading"
            class="inset-0 z-[9999] flex items-center justify-center bg-white/50 backdrop-blur-sm cursor-not-allowed"
          >
            <LoadingSpinner />
          </div>
          <div class="overflow-y-auto max-h-[50vh] divide-y divide-gray-200">
            <div v-for="(item, index) in urls" :key="index" class="p-4 space-y-2">
              <p>
                <span class="font-semibold">{{ t('name') }}: </span>
                {{ item.name || 'N/A' }}
              </p>
              <p>
                <span class="font-semibold">{{ t('organization') }}: </span>
                {{ item.organization?.title || 'N/A' }}
              </p>
              <p>
                <span class="font-semibold">{{ t('license') }}: </span>
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
                <span class="font-semibold">{{ t('datasetUrl') }}: </span>
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
        </div>
      </UCard>
    </template>
  </UModal>
</template>

<script setup lang="ts">
import LoadingSpinner from './LoadingSpinner.vue';

const props = defineProps<{
  fileName: string
  showUrlCard: boolean
}>();

const emit = defineEmits(['close']);
const { t } = useI18n();
const showModal = ref(props.showUrlCard);

watch(() => props.showUrlCard, (val) => {
  showModal.value = val;
});

watch(showModal, (val) => {
  if (!val)
    emit('close');
});
const loading = ref(false);
const urls = ref<UrlInfo[]>([]);

watch(() => props.fileName, async (newFile) => {
  if (!newFile)
    return;

  loading.value = true;
  try {
    urls.value = await $fetch<UrlInfo[]>(
      `/api/fetchOpenData/meta-information?feature=${encodeURIComponent(newFile)}`,
    );
  }
  catch (err) {
    console.error('Failed to fetch URLs', err);
    urls.value = [];
  }
  finally {
    loading.value = false;
  }
}, { immediate: true });

function closeCard() {
  emit('close');
}
</script>
