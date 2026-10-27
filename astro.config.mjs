// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import sitemap from '@astrojs/sitemap';

// https://astro.build/config
export default defineConfig({
  site: 'https://cleanclean-mie.jp',
  // Astro 6と同じ空白処理を維持する。
  compressHTML: true,
  vite: {
    plugins: [tailwindcss()]
  },
  integrations: [sitemap()],
  adapter: vercel()
});
