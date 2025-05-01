<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>

<script setup lang="ts">
const toast = useToast();
const { t } = useI18n();
onErrorCaptured((error) => {
  console.error(error);
  toast.add({
    title: t('error_occurred'),
    description: error.message,
    color: 'error',
  });
});
</script>
