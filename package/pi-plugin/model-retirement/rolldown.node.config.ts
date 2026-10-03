import {
  perEntryNodeConfig,
  type NodeFlavorConfigs,
} from '@monochromatic-dev/config-rolldown/.node.ts';

/**
 Single-entry extension build for the model retirement package.
 */
const config: NodeFlavorConfigs = perEntryNodeConfig({
  entries: [
    './src/index.ts',
  ],
},);

export default config;
