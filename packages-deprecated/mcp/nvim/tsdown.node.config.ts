import base from '@monochromatic-dev/config-tsdown/.node.ts';
import { defineConfig, } from 'tsdown';

export default defineConfig({
  ...base,
  deps: {
    ...base.deps,
    alwaysBundle: [
      ...(base.deps
        ?.alwaysBundle
        ?? []),
      'neovim',
    ],
  },
},);
