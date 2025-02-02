import { defineConfig } from 'astro/config';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import { browserslistToTargets, composeVisitors } from 'lightningcss';
import browserslist from 'browserslist';
import { resolveToEsbuildTarget } from 'esbuild-plugin-browserslist';
import apply from '@monochromatic-dev/lightningcss-plugin-apply';
import customUnits from '@monochromatic-dev/lightningcss-plugin-custom-units';
import propertyLookup from '@monochromatic-dev/lightningcss-plugin-property-lookup';
import size from '@monochromatic-dev/lightningcss-plugin-size';
import astroGenConsts from '@monochromatic-dev/astro-integration-gen-consts';

// https://astro.build/config
// TODO: here.
export default defineConfig({
  integrations: [astroGenConsts(), mdx({ optimize: true }), sitemap()],

  /* For our code that's handling generation of redirects pages,
     a forward slash at the beginning means after the base path.
     (The config for base path is injected during astroGenConsts().) */
  redirects: {
    '/posts/[...slug]': '/post/[...slug]',
    '/*/posts/[...slug]': '/*/post/[...slug]',
  },

  /* We're not actually building a hybrid website.
     We're only building a static site.
     Specifing this just so that Astro that's refuse to build when we specify "redirects".
     Actual logic for generating redirects will be handled with our own code. */
  output: 'hybrid',

  /* To be updated in astroGenConsts()
     FIXME: Couldn't get it working. This is a showstopper bug.
     10:22:12 [build] output: "hybrid"
     Invalid URL
     Stack trace:
      at new URL (node:internal/url:796:36)
      at AstroBuilder.build (file:///workspaces/monochromatic2024MAR06/node_modules/.pnpm/astro@4.6.1_@types+node@20.12.7_lightningcss@1.24.1_typescript@5.4.4/node_modules/astro/dist/core/build/index.js:104:50)
      at async build (file:///workspaces/monochromatic2024MAR06/node_modules/.pnpm/astro@4.6.1_@types+node@20.12.7_lightningcss@1.24.1_typescript@5.4.4/node_modules/astro/dist/core/build/index.js:46:3)
      at async runCommand (file:///workspaces/monochromatic2024MAR06/node_modules/.pnpm/astro@4.6.1_@types+node@20.12.7_lightningcss@1.24.1_typescript@5.4.4/node_modules/astro/dist/cli/index.js:141:7)
      ELIFECYCLE  Command failed with exit code 1. */

  // outDir: pathToFileURL(''),

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
    server: {
      strictPort: true,
    },
    build: {
      target: resolveToEsbuildTarget(browserslist()),
      cssMinify: 'lightningcss',
      sourcemap: 'hidden',
      ssrEmitAssets: true,
      minify: 'esbuild',

      modulePreload: {
        // All our targets support it.
        polyfill: false,
      },
    },
    worker: {
      format: 'es',
    },
    optimizeDeps: {},
    plugins: [],
  },

  build: {
    client: './c',
    server: './s',
    assets: '_a',
  },

  server: {
    host: true,
  },

  devToolbar: {
    // Lackluster
    enabled: false,
  },

  prefetch: {
    defaultStrategy: 'viewport',
    prefetchAll: true,
  },

  markdown: {
    remarkPlugins: [],
    rehypePlugins: [],
    shikiConfig: {
      wrap: true,
    },
  },

  i18n: {
    defaultLocale: 'en',

    // To be overriden in the Astro plugin gen-consts
    locales: ['en'],
  },

  experimental: {
    directRenderScript: true,
    contentCollectionCache: true,
    contentCollectionJsonSchema: true,
    clientPrerender: true,

    // We want the warnings.
    globalRoutePriority: true,
  },
});
