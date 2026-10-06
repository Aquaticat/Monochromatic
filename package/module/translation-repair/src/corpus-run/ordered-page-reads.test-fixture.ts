//region Ordered page reads
// A PAGE READER WHOSE REFUSALS END IN AN ORDER A CASE CHOOSES.
//
// TEST SUPPORT, NOT PACKAGE SOURCE. A site that reads several pages of a
// commit the clone lacks gets one refusal per page, each naming its own page.
// A case hands the site this reader in place of `readCorpusFile`: every read
// refuses as git does for an absent path, the reads whose path holds
// `endsLast` refuse only after every other read has, and the rest refuse at
// once.

import {
  CorpusReadError,
  type readCorpusFile,
} from '../../dist/final/node/index.mjs';
import { refusalOrder, } from '../refusal-order.test-fixture.ts';

/**
 Makes a reader whose every read refuses, in an order the case fixes.

 @param endsLast - text a path holds when its read refuses after the others

 @returns A reader to pass in place of `readCorpusFile`

 @example
 ```ts
 const readFile = pageReadsRefusingLastFor({ endsLast: '/page.md', },);
 ```
 */
export function pageReadsRefusingLastFor(
  { endsLast, }: { readonly endsLast: string; },
): typeof readCorpusFile {
  /**
   The two refusals the reads end in.
   */
  const {
    refuseAtOnce,
    refuseAfterThat,
  } = refusalOrder();
  return async function refusesLastFor(
    {
      pin,
      relPath,
    }: Parameters<typeof readCorpusFile>[0],
  ): Promise<string> {
    /**
     What git says of a path the commit does not carry.
     */
    const absent = new CorpusReadError({
      detail: `${pin.commitSha}:${relPath}`,
      cause: { stderr: `fatal: path '${relPath}' does not exist in '${pin.commitSha}'`, },
    },);
    return await (relPath.includes(endsLast,) ? refuseAfterThat(absent,) : refuseAtOnce(absent,));
  };
}

//endregion Ordered page reads
