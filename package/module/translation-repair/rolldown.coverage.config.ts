import { nodeConfig, } from '@monochromatic-dev/config-rolldown/.node.ts';

import { nodeEntries, } from './src/build-entries.ts';

// Ledger T8: the normal build's entries with a source map beside every chunk,
// for the coverage census. V8 reports coverage by bundle offset, and the maps
// carry each offset back to a source line. The `coverage-census` task builds
// this, runs the census, then runs the normal build again, so no launch
// freezes a mapped build.
//
// UNMINIFIED, unlike the normal build (ledger M79). The shared Node output
// compresses, and compression rewrites control flow: `if (x) continue;`
// becomes `!x && (...)`, a chain of `if (...) return false;` guards becomes
// one `||` expression, and an `if` whose branches swap places maps its cold
// arm across every line between them. Measured on one commit
// (`census-VdHVJb` against `census-gMPS3j`), the compressed build reported
// 1,039 library stretches over 2,541 lines and the unminified one 1,184 over
// 2,481: the extra stretches are guards compression had folded away, the
// missing lines are neighbours and spans of lines that ran. The unit suite
// passed 1,395 times on both, so the tests do not depend on minification.
// The census refuses a minified build before the suite runs
// (`requireUnminifiedBuild` in `src/corpus-run/coverage-bundle-maps.ts`).

/**
 Node build with source maps and no minification, for
 `mise run coverage-census`.

 @example
 ```ts
 // Consumed by the coverage-census task's build step.
 ```
 */
const config: ReturnType<typeof nodeConfig> = nodeConfig({
  input: Object.fromEntries(nodeEntries,),
  outputOverrides: {
    sourcemap: true,
    minify: false,
  },
},);

export default config;
