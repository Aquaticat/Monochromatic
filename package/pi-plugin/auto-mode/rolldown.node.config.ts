/**
 Shared chunks preserve policy function, error, and retained-state identities across native and extension consumers.

 @module
 */
import { nodeConfig } from '@monochromatic-dev/config-rolldown/.node.ts';

/** Both entries share emitted implementation identities without sharing SDK initialization. */
const config: ReturnType<typeof nodeConfig> = nodeConfig({
  input: {
    index: './src/index.ts',
    'native-policy': './src/native-policy-api.ts',
  },
});

export default config;
