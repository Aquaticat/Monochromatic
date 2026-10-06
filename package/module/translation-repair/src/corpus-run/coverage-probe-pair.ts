import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import {
  type CorpusPin,
  readCorpusFile,
} from '../corpus-source.ts';

//region Coverage probe pair
// Both sides of one entry, or the fact that it has only one.

/**
 Both sides of one entry, or the fact that it has only one.

 @example
 ```ts
 const texts: PairRead = { kind: 'missing', };
 ```
 */
export type PairRead = {
  /**
   Both files were there.
   */
  readonly kind: 'read';

  /**
   Original document text.
   */
  readonly source: string;

  /**
   Translation document text.
   */
  readonly target: string;
} | {
  /**
   One side is absent, which is an incomplete entry rather than a fault.
   */
  readonly kind: 'missing';
};

/**
 Reads both sides of one entry at the pin.

 READS THAT FAIL ARE SKIPPED AND LOGGED rather than thrown, since an entry
 with only one side is an ordinary state of this corpus. That also swallows an
 unreadable clone, which shows up as every entry skipping.

 @param pin - corpus clone and commit the reads resolve against

 @param entryId - entry to read

 @param log - logger the skip is written to

 @returns Both texts, or `missing` when either read failed

 @example
 ```ts
 const texts = await readPair({ pin, entryId: 'Mittens', log, },);
 ```
 */
export async function readPair(
  {
    pin,
    entryId,
    log,
  }: {
    readonly pin: CorpusPin;
    readonly entryId: string;
    readonly log: Logger;
  },
): Promise<PairRead> {
  try {
    return {
      kind: 'read',
      source: await readCorpusFile({
        pin,
        relPath: `people/${entryId}/page.md`,
      },),
      target: await readCorpusFile({
        pin,
        relPath: `people/${entryId}/page.en.md`,
      },),
    };
  }
  catch (error) {
    log.info(`${entryId}: skipped, ${String(error,)}`,);
    return { kind: 'missing', };
  }
}

//endregion Coverage probe pair
