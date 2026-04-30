import base from '@monochromatic-dev/config-tsdown/.client.ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Client-side browser bundle config for paper2vn.
 * Bundles the SPA entry into a single `dist/client/main.js` for HTML embedding.
 * Always minified since output is inlined into a self-contained HTML file.
 */
const config: UserConfig = defineConfig({
  ...base,
  entry: ['./src/client/main.ts',],
  /**
   * Override the base `deps.alwaysBundle` allowlist so the
   * single-file HTML output stays self-contained. Without these
   * entries, tsdown's neutral platform leaves the third-party
   * imports as external `import` statements and the browser falls
   * over.
   */
  deps: {
    alwaysBundle: [
      /^@monochromatic-dev\//,
      /^@lezer\//,
      /^lezer-/,
      /^jspdf$/,
      /^typesafe-i18n/,
      /^pdfjs-dist/,
    ],
  },
  minify: {
    compress: true,
    // Mangle breaks func.name and makes output difficult for users to audit.
    mangle: false,
    codegen: true,
  },
},);
export default config;
