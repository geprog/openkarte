<template>
  <div class="flex h-lvh flex-col">
    <UNavigationMenu :items class="w-full" />
    <main class="mx-auto mb-20 flex items-center h-full w-full max-w-6xl flex-col p-2 py-4 sm:py-6 lg:py-8">
      <slot />
    </main>
  </div>
</template>

<script setup lang="ts">
import type { NavigationMenuItem } from '@nuxt/ui';

const { t } = useI18n();

const items = computed<NavigationMenuItem[]>(() => [
  [
    {
      label: t('start_page'),
      to: '/',
    },
    {
      label: t('other_page'),
      to: '/other',
    },
  ],
]);
</script>
