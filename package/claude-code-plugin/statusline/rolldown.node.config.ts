import {
  nodeConfig,
  type NodeFlavorConfig,
} from '@monochromatic-dev/config-rolldown/.node.ts';

/**
 * Node build for the statusline plugin.
 *
 * The package is a CLI-first utility whose public entry is `src/statusline.ts`,
 * so the build maps that file to the emitted `statusline.mjs` instead of the
 * usual `index.mjs` entry.
 */
const config: NodeFlavorConfig = nodeConfig({ input: ['./src/statusline.ts',], },);

export default config;
