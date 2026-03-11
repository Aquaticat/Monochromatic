import base from '@monochromatic-dev/config-tsdown/.client.ts';
import { defineConfig, } from 'tsdown';

/**
 * Client-side browser bundle config for the Done h-css test variant.
 * Bundles five page entry points into `dist/client/*.js`.
 * No import-attributes plugin needed: h-css generates styles at runtime.
 */
export default defineConfig({
  ...base,
  entry: [
    './src/client/inbox.ts',
    './src/client/in-progress.ts',
    './src/client/task-details.ts',
    './src/client/search.ts',
    './src/client/settings.ts',
  ],
});
