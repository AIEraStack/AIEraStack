// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  integrations: [react()],
  vite: {
    plugins: [tailwindcss()],
    build: {
      // Ensure CJS dependencies are properly transformed to ESM during build.
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
    // NOTE: No react-dom/server alias here.
    // The Cloudflare adapter handles aliasing for production builds internally.
    // In dev mode, Node.js loads react-dom/server natively (CJS is supported).
  },
});
