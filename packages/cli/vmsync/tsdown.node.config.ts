import base from '@monochromatic-dev/config-tsdown/.node.ts';
import {
  defineConfig,
  type UserConfig,
} from 'tsdown';

/** Build configuration for vmsync CLI, bundling workspace and optique dependencies. */
const config: UserConfig = defineConfig({
  ...base,
  entry: ['./src/index.ts',],
  deps: {
    ...base.deps,
    alwaysBundle: [
      /^@monochromatic-dev\//,
      /^@optique\//,
      /^nano-spawn$/,
    ],
  },
},);

export default config;
