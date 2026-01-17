// @ts-check
import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwindcss from '@tailwindcss/vite';
import cloudflare from '@astrojs/cloudflare';

/** @type {typeof globalThis & { process?: { env?: { NODE_ENV?: string } } }} */
const globalWithProcess = globalThis;
const isProd = globalWithProcess.process?.env?.NODE_ENV === 'production';
const reactServerAlias = isProd
  ? [
      // Ensure Cloudflare Workers uses the edge server entrypoint for React SSR.
      // This avoids the browser build which depends on MessageChannel.
      { find: 'react-dom/server', replacement: 'react-dom/server.edge' },
    ]
  : [];

export default defineConfig({
  output: 'server',
  adapter: cloudflare(),
  integrations: [react()],
  vite: {
    resolve: {
      alias: reactServerAlias,
    },
    plugins: [tailwindcss()],
    build: {
      // Ensure CJS dependencies are properly transformed to ESM during build.
      commonjsOptions: {
        transformMixedEsModules: true,
      },
    },
    // NOTE: The Cloudflare adapter aliases react-dom/server to the browser build.
    // We override it above in production to use the edge build in Workers.
  },
});
