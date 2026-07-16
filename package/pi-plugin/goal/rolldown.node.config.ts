import {
  nodeConfig,
  type NodeFlavorConfig,
} from '@monochromatic-dev/config-rolldown/.node.ts';

/**
 * Node bundle loaded by Pi package discovery.
 *
 * @example
 * ```ts
 * export default config;
 * ```
 */
const config: NodeFlavorConfig = nodeConfig({
  input: [
    './src/index.ts',
  ],
},);

export default config;
