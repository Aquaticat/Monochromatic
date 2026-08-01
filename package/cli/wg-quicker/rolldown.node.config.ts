import {
  type NodeFlavorConfigs,
  perEntryNodeConfig,
} from '@monochromatic-dev/config-rolldown/.node.ts';

/**
 * Self-contained production CLI and public tunnel-orchestration bundles.
 */
const config: NodeFlavorConfigs = perEntryNodeConfig({
  entries: [
    './src/index.ts',
    './src/application-exemption.ts',
    './src/tunnel.ts',
    './src/config.ts',
    './src/tunnel-bypass.ts',
    './src/tunnel-bypass-route.ts',
    './src/bypass-watch.ts',
  ],
},);

export default config;
