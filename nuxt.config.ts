// https://nuxt.com/docs/api/configuration/nuxt-config
import process from 'node:process';

export default defineNuxtConfig({
  compatibilityDate: '2026-10-07',
  devtools: { enabled: true },
  telemetry: false,
  ssr: false,
  modules: ['@nuxt/ui', '@nuxtjs/i18n'],
  css: ['~/assets/css/main.css'],
  app: {
    head: {
      title: 'OpenKarte',
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
  },
});
