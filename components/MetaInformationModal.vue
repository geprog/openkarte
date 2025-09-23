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
              <div v-if="item.nested_series && item.nested_series.length > 0" class="mt-2">
                <button
                  class="text-sm hover:underline flex items-center" variant="outline" color="blue" @click="toggleNested(index)"
                >
                  <span v-if="openIndexes.includes(index)">▼ {{ t('hideNested') }}</span>
                  <span v-else>▶ {{ t('showNested') }}</span>
                </button>
                <div
                  v-if="openIndexes.includes(index)"
                  class="ml-6 mt-2 border-gray-200 pl-4 space-y-2 divide-y"
                >
                  <div
                    v-for="(nested, nestedIndex) in item.nested_series"
                    :key="nestedIndex"
                    class="space-y-1"
                  >
                    <p>
                      <span class="font-semibold">{{ t('name') }}: </span>
                      {{ nested.name || 'N/A' }}
                    </p>
                    <p>
                      <span class="font-semibold">{{ t('organization') }}: </span>
                      {{ nested.organization?.title || 'N/A' }}
                    </p>
                    <p>
                      <span class="font-semibold">{{ t('license') }}: </span>
                      <a
                        v-if="nested.license_url"
                        :href="nested.license_url"
                        target="_blank"
                        rel="noopener"
                        class="text-blue-600 hover:underline"
                      >
                        {{ nested.license_title }}
                      </a>
                      <span v-else>{{ nested.license_title || 'N/A' }}</span>
                    </p>
                    <p>
                      <span class="font-semibold">{{ t('datasetUrl') }}: </span>
                      <a
                        :href="nested.url"
                        target="_blank"
                        rel="noopener"
                        class="text-blue-600 hover:underline"
                      >
                        {{ nested.url }}
                      </a>
                    </p>
                  </div>
                </div>
              </div>
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
const openIndexes = ref<number[]>([]);

function toggleNested(index: number) {
  if (openIndexes.value.includes(index)) {
    openIndexes.value = openIndexes.value.filter(i => i !== index);
  }
  else {
    openIndexes.value.push(index);
  }
}

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
