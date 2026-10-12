/**
 The text of the artifact parse refusal a read of a recorded consistency
 value threw, for the cases that pin each reader's refusals whole.

 Fixtures are cat-themed invention; no corpus content appears here.

 @module
 */

import { caught, } from '@monochromatic-dev/module-test/ts';

import { ArtifactParseError, } from '../../dist/final/node/index.mjs';

//region Consistency refusal text

/**
 Text of the artifact parse refusal a read threw.

 @param read - read that must refuse

 @returns The refusal as text, class name first

 @throws {@link Error} when the read threw something other than an artifact parse refusal

 @example
 ```ts
 const text = refusalTextOf({ read: function readsABrokenBallot() { return parseConsistencyBallot({ value: 3, path: 'cat.ballot', },); }, },);
 ```
 */
export function refusalTextOf({ read, }: { readonly read: () => unknown; },): string {
  /**
   What the read threw.
   */
  const refusal = caught(read,);
  if (!(refusal instanceof ArtifactParseError)) {
    throw new Error(
      `Expected the read to throw an ArtifactParseError, but it threw ${
        Error.isError(refusal,) ? `${refusal.name}: ${refusal.message}` : typeof refusal
      }`,
    );
  }
  return String(refusal,);
}

//endregion Consistency refusal text
