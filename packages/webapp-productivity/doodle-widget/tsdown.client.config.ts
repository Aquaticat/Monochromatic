import base from '@monochromatic-dev/config-tsdown/.client.ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Client-side browser bundle config for the doodle widget.
 * Bundles the drawing canvas, background management, and event handling
 * modules into a single `dist/client/main.js` for HTML embedding.
 * Always minified since the output is inlined into a self-contained HTML file.
 */
const config: UserConfig = defineConfig({
  ...base,
  entry: ['./src/client/main.ts',],
  minify: {
    compress: true,
    // Mangle breaks func.name and makes output difficult for users to audit.
    mangle: false,
    codegen: true,
  },
},);
export default config;
