import base from '@monochromatic-dev/config-tsdown/.client.ts';
import { importAttributesPlugin, } from '@monochromatic-dev/rolldown-plugin-import-attributes/ts';
import { defineConfig, } from 'tsdown';

/**
 * Client-side browser bundle config for the flashcard quiz app.
 * Bundles two page entry points into `dist/client/*.js`.
 * Uses the import-attributes plugin so client code can import
 * pre-built CSS via `with { type: 'text' }`.
 */
export default defineConfig({
  ...base,
  entry: [
    './src/client/decks.ts',
    './src/client/quiz.ts',
  ],
  plugins: [importAttributesPlugin(),],
});
