import { nodeConfig, } from '@monochromatic-dev/config-rolldown/.node.ts';

import { nodeEntries, } from './src/build-entries.ts';

// Ledger T8: the normal build with a source map beside every chunk, for the
// coverage census. V8 reports coverage by bundle offset, and the maps carry
// each offset back to a source line. The chunks hold the same code as the
// normal build's; each gains a trailing `sourceMappingURL` comment. The
// `coverage-census` task builds this, runs the census, then runs the normal
// build again, so no launch freezes a mapped build.

/**
 Node build with source maps, for `mise run coverage-census`.

 @example
 ```ts
 // Consumed by the coverage-census task's build step.
 ```
 */
const config: ReturnType<typeof nodeConfig> = nodeConfig({
  input: nodeEntries,
  outputOverrides: { sourcemap: true, },
},);

export default config;
