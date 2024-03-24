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
import rehypePluginSummary from '@monochromatic.dev/rehype-plugin-summary';
import astroGlobs from '@monochromatic.dev/astro-integration-globs';
import astroGenConsts from '@monochromatic.dev/astro-integration-gen-consts';
import genMatchLangCss from '@monochromatic.dev/astro-integration-gen-match-lang-css';

// https://astro.build/config
export default defineConfig({
  integrations: [astroGenConsts(), mdx(), astroGlobs(), sitemap(), genMatchLangCss()],
  scopedStyleStrategy: 'where',
  vite: {
    css: {
      devSourcemap: true,
      transformer: 'lightningcss',
      lightningcss: {
        targets: browserslistToTargets(browserslist()),
        cssModules: { pattern: '[local]' },
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
