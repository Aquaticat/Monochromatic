import { nodeConfig, } from '@monochromatic-dev/config-rolldown/.node.ts';

import { nodeEntries, } from './src/build-entries.ts';

// The entry list, and why every runner is an entry, live in
// `src/build-entries.ts`, which the coverage build and the coverage census
// read too.

/**
 Normal Node build retains the repository's existing external-dependency policy.

 @example
 ```ts
 // Consumed by the ordinary package build task.
 ```
 */
const config: ReturnType<typeof nodeConfig> = nodeConfig({ input: nodeEntries, },);

export default config;
