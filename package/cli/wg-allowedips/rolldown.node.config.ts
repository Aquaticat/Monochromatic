import { perEntryNodeConfig, } from '@monochromatic-dev/config-rolldown/.node.ts';

/**
 * Self-contained production, public-library, and internal test-seam bundles.
 */
const config = perEntryNodeConfig({
  entries: [
    './src/index.ts',
    './src/generate.ts',
    './src/generate-with-lookup.ts',
  ],
},);

export default config;
