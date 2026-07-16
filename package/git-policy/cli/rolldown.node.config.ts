import {
  nodeConfig,
  type NodeFlavorConfig,
} from '@monochromatic-dev/config-rolldown/.node.ts';

/**
 * Node build configuration for the shadow bin and authoring API.
 *
 * Unminified single-chunk output: build diagnostics and stack traces feed
 * the cli-git trust flow, and `codeSplitting: false` keeps dynamic imports
 * inline so the bin stays one auditable file.
 */
const config: NodeFlavorConfig = nodeConfig({
  outputOverrides: {
    minify: false,
    codeSplitting: false,
  },
},);

export default config;
