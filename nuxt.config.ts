// https://nuxt.com/docs/api/configuration/nuxt-config
import process from 'node:process';

export default defineNuxtConfig({
  compatibilityDate: '2025-01-27',
  devtools: { enabled: true },
  telemetry: false,
  ssr: false,
  modules: ['@nuxt/ui', '@nuxtjs/i18n'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'Nuxt Template',
      titleTemplate: '%s',
      charset: 'utf-8',
      viewport: 'width=device-width, initial-scale=1',
    },
  },
  vite: {
    server: {
      allowedHosts: process.env.GITPOD_WORKSPACE_CLUSTER_HOST ? [`3000-${process.env.HOSTNAME}.${process.env.GITPOD_WORKSPACE_CLUSTER_HOST}`] : undefined,
    },
  },
  typescript: {
    strict: true,
  },
  i18n: {
    locales: [
      { code: 'en', file: 'en.json' },
      { code: 'de', file: 'de.json' },
    ],
    strategy: 'no_prefix',
    defaultLocale: 'en',
    bundle: {
      optimizeTranslationDirective: false, // recommend to disable. see https://github.com/nuxt-modules/i18n/issues/3238#issuecomment-2672492536
    },
  },
});
