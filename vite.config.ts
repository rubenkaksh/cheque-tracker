/// <reference types="vitest/config" />
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig(({ mode }) => ({
  base: loadEnv(mode, '.', 'VITE_').VITE_BASE || '/',
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // precache the self-hosted Latin font files so the app keeps its fonts offline
      workbox: { globPatterns: ['**/*.{js,css,html}', '**/*-latin-[0-9]*-normal-*.woff2'] },
      manifest: {
        name: 'Collection Desk',
        short_name: 'Collection Desk',
        display: 'standalone',
        start_url: './',
        scope: './',
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    setupFiles: ['tests/setup.ts'],
    include: ['tests/**/*.test.{ts,tsx}'],
  },
}))
