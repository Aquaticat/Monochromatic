/**
 Build the TypeScript plugin through the standard Node configuration.

 @module
 */
import { nodeConfig } from '@monochromatic-dev/config-rolldown/.node.ts';

/**
 Plugin entry is supplied by the replacement implementation after design review.
 */
const config: ReturnType<typeof nodeConfig> = nodeConfig({
  input: {
    index: './src/index.ts',
  },
});

export default config;
