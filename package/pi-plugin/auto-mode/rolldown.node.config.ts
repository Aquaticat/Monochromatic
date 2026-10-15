/**
 Shared chunks preserve policy function, error, and retained-state identities across native and extension consumers.

 @module
 */
import { nodeConfig } from '@monochromatic-dev/config-rolldown/.node.ts';

export default nodeConfig({
  input: {
    index: './src/index.ts',
    'native-policy': './src/native-policy-api.ts',
  },
});
