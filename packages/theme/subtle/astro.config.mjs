import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { browserslistToTargets, composeVisitors } from 'lightningcss';
import browserslist from 'browserslist';
import { resolveToEsbuildTarget } from 'esbuild-plugin-browserslist';
import apply from '@monochromatic.dev/lightningcss-plugin-apply';
import customUnits from '@monochromatic.dev/lightningcss-plugin-custom-units';
import propertyLookup from '@monochromatic.dev/lightningcss-plugin-property-lookup';
import size from '@monochromatic.dev/lightningcss-plugin-size';
import remarkPluginModifiedTime from '@monochromatic.dev/remark-plugin-modified-time';
import astroGlobs from '@monochromatic.dev/astro-integration-globs';
import astroGenConsts from '@monochromatic.dev/astro-integration-gen-consts';

// https://astro.build/config
// TODO: here.
export default defineConfig({
  integrations: [astroGenConsts(), mdx(), astroGlobs(), sitemap()],
  scopedStyleStrategy: 'where',
  vite: {
    css: {
      devSourcemap: true,
      transformer: 'lightningcss',
      lightningcss: {
        targets: browserslistToTargets(browserslist()),
        cssModules: { pattern: '[local]' },

        // @ts-expect-error Object literals may only specify known properties ... probably because Vite or Astro haven't updated their config to reflect the actually existing analyzeDependencies option from LightningCSS yet.
        analyzeDependencies: true,

        visitor: composeVisitors([apply, customUnits, propertyLookup, size]),
        drafts: { customMedia: true },
      },
    },
    esbuild: {
      minifyIdentifiers: false,
    },
    build: {
      target: resolveToEsbuildTarget(browserslist()),
      cssMinify: 'lightningcss',
    },
    worker: {
      format: 'es',
    },
    optimizeDeps: {},
    plugins: [],
  },
  build: {},
  server: {
    host: true,
  },
  prefetch: {
    defaultStrategy: 'viewport',
  },
  markdown: {
    remarkPlugins: [remarkPluginModifiedTime],
    rehypePlugins: [],
    shikiConfig: {
      wrap: true,
    },
  },
  experimental: {},
});
