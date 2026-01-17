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
    resolve: {
      // Use the edge renderer to avoid MessageChannel in the Workers runtime.
      alias: {
        'react-dom/server': 'react-dom/server.edge',
      },
    },
    ssr: {
      // Ensure SSR deps are fully inlined for Workers (no require/module at runtime).
      noExternal: true,
    },
  },
});
