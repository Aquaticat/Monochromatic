/**
 The digest of the built output, which the as-built suites of the score
 commands expect the pool to print as the pipeline that read it.

 TEST SUPPORT, NOT PACKAGE SOURCE. No child is started here; the as-built
 suites start theirs through `runBuiltCommand` of
 `child-environment.test-fixture.ts`.

 Fixtures are cat-themed invention. No corpus content appears here.

 @module
 */

import { join, } from 'node:path';

import { digestPipeline, } from '../../dist/final/node/index.mjs';

/**
 Digest of the built output, which the pool prints as the pipeline that read it.

 @returns Digest text, as the pool's `POOL read by pipeline` line carries it

 @example
 ```ts
 const stamp = await builtPipelineDigest();
 ```
 */
export async function builtPipelineDigest(): Promise<string> {
  /**
   Stamp of the directory the built commands and the index sit in.
   */
  const { digest, } = await digestPipeline({
    dir: join(
      import.meta.dirname,
      '../../dist/final/node',
    ),
  },);
  return digest;
}
