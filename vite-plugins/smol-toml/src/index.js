import { parse } from 'smol-toml';

// Copypasted from https://vitejs.dev/guide/api-plugin.html#transforming-custom-file-types

// Heavily inspired from https://github.com/sapphi-red/vite-plugin-toml/blob/main/src/index.ts

export default () => ({
  name: 'smol-toml',
  transform(src, id) {
    if (id.endsWith('.toml')) {
      return { code: parse(src) };
    }
  },
});
