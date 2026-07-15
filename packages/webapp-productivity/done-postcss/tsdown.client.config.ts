import base from '@monochromatic-dev/config-tsdown/.client.ts';
import {
  importAttributesPlugin,
} from '@monochromatic-dev/rolldown-plugin-import-attributes/ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/**
 * Client-side browser bundle config for the Done productivity app.
 * Bundles five page entry points into `dist/client/*.js`.
 * Uses the import-attributes plugin so client code can import
 * pre-built CSS via `with { type: 'text' }`.
 */
const config: UserConfig = defineConfig({
  ...base,
  deps: {
    ...base.deps,
    onlyBundle: [
      'nanoid',
      'picocolors',
      'postcss',
    ],
  },
  entry: [
    './src/client/inbox.ts',
    './src/client/in-progress.ts',
    './src/client/task-details.ts',
    './src/client/search.ts',
    './src/client/settings.ts',
  ],
  platform: 'browser',
  plugins: [importAttributesPlugin(),],
},);
export default config;
