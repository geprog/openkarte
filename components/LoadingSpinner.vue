<template>
  <div class="flex flex-col items-center justify-center p-4 space-y-2">
    <svg
      class="animate-spin h-10 w-10 text-slate-900"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        class="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        stroke-width="4"
      />
      <path
        class="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8v8z"
      />
    </svg>
    <span class="text-sm text-slate-900 font-medium">{{ t('loadingText') }}</span>
  </div>
</template>

<script setup lang="ts">
const { t } = useI18n();
</script>
