import base from '@monochromatic-dev/config-tsdown/.node.ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

const config: UserConfig = defineConfig({
  ...base,
  deps: {
    ...base.deps,
    alwaysBundle: [
      // `base.deps.alwaysBundle` is typed as `NoExternalFn | Arrayable<...>`;
      // narrow to the array case before spreading so a function/scalar value
      // can't be spread. The base always supplies an array.
      ...(Array.isArray(base.deps?.alwaysBundle,)
        ? base.deps.alwaysBundle
        : []),
      'neovim',
    ],
  },
},);

export default config;
