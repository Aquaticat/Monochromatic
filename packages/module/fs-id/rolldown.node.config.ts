import { nodeConfig, } from '@monochromatic-dev/config-rolldown/.node.ts';

/**
 * Node build with the public entry plus the testing sub-entry, so consumers
 * import deterministic fixtures without reaching into src.
 */
const config = nodeConfig({
  input: {
    index: './src/index.ts',
    testing: './src/testing.ts',
  },
},);

export default config;
