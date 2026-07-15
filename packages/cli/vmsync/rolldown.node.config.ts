import {
  nodeConfig,
  nodeExternal,
} from '@monochromatic-dev/config-rolldown/.node.ts';

/**
 * Node build inlining the argument-parsing stack alongside workspace source,
 * so the bin stays runnable without install-time dependencies.
 */
const config = nodeConfig({
  external: await nodeExternal({
    alwaysBundle: [
      '@monochromatic-dev/**',
      '@optique/**',
      'nano-spawn',
    ],
  },),
},);

export default config;
