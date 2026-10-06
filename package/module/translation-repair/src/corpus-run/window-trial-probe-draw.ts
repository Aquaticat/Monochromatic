import type { Logger, } from '@monochromatic-dev/module-logger/ts';

import type { ChunkPair, } from '../chunk-document.ts';
import {
  type CorpusPin,
  isMissingCorpusObject,
} from '../corpus-source.ts';
import { classifyDisplacement, } from '../displacement-class.ts';
import { sliceSizesOf, } from '../displacement-ratio.ts';
import { prepareDocumentPair, } from '../document-preparation.ts';
import {
  controlSlices,
  flaggedSlices,
  type TrialSlice,
} from './window-trial-draw.ts';

//region Window trial probe draw
// What one entry contributes to the trial: its two pages read from the pinned
// corpus, prepared as the lanes see them, screened, and the flagged slices
// drawn with their controls. Moved out of `window-trial-probe.ts`, which keeps
// the wiring. The corpus is reached through a reader the caller passes, so a
// case scripts the pages and the command passes `readCorpusFile`.

/**
 Controls drawn per entry that contributes any flagged slice.

 Small on purpose. Controls exist to detect a general context-induced
 conservatism, which would show across many entries rather than within one, so
 breadth is worth more here than depth.
 */
const CONTROLS_PER_ENTRY = 1;

/**
 Reader of one page of the pinned corpus, as `readCorpusFile` is.

 @example
 ```ts
 const readPage: CorpusPageReader = readCorpusFile;
 ```
 */
export type CorpusPageReader = (
  input: {
    /**
     Corpus checkout and commit the read resolves against.
     */
    readonly pin: CorpusPin;

    /**
     Path of the page inside the corpus.
     */
    readonly relPath: string;
  },
) => Promise<string>;

/**
 Both sides of one entry, or the fact that it carries only one.

 @example
 ```ts
 const texts: PairTexts = { kind: 'missing', };
 ```
 */
type PairTexts = {
  /**
   Entry carries both sides.
   */
  readonly kind: 'read';

  /**
   Original page.
   */
  readonly source: string;

  /**
   Translated page.
   */
  readonly target: string;
} | {
  /**
   Entry carries one side, which is an ordinary state of this corpus.
   */
  readonly kind: 'missing';
};

/**
 What one entry contributes, with the preparation the picks index into.

 @example
 ```ts
 const drawn: DrawnEntry = { picks: [], slices: [], };
 ```
 */
export type DrawnEntry = {
  /**
   Slices to buy, flagged then controls.
   */
  readonly picks: readonly TrialSlice[];

  /**
   Every prepared slice of the entry, which a pick's index points into.
   */
  readonly slices: readonly ChunkPair[];
};

/**
 Reads both sides of one entry.

 @param entryId - entry to read

 @param pin - corpus checkout and commit to read at

 @param readPage - reader of one corpus page

 @param l - logger the skip of an entry with one side is told to

 @returns Both texts, absent when either side is missing

 @throws Whatever the read threw, when it was not a corpus read failure

 @example
 ```ts
 const texts = await readPairTexts({ entryId, pin, readPage, l, },);
 ```
 */
async function readPairTexts(
  {
    entryId,
    pin,
    readPage,
    l,
  }: {
    readonly entryId: string;
    readonly pin: CorpusPin;
    readonly readPage: CorpusPageReader;
    readonly l: Logger;
  },
): Promise<PairTexts> {
  try {
    return {
      kind: 'read',
      source: await readPage({
        pin,
        relPath: `people/${entryId}/page.md`,
      },),
      target: await readPage({
        pin,
        relPath: `people/${entryId}/page.en.md`,
      },),
    };
  }
  catch (error) {
    if (!isMissingCorpusObject(error,))
      throw error;
    l.info(`${entryId}: skipped, ${String(error,)}`,);
    return { kind: 'missing', };
  }
}

/**
 Slices one entry contributes, flagged plus its controls.

 @param entryId - entry to read

 @param pin - corpus checkout and commit to read at

 @param readPage - reader of one corpus page

 @param l - logger the skip of an entry with one side is told to

 @returns Slices to buy and the preparation they index into, empty when the
 entry cannot be read or the screen flagged nothing

 @throws Whatever the read threw, when it was not a corpus read failure

 @example
 ```ts
 const drawn = await drawEntry({ entryId, pin, readPage, l, },);
 ```
 */
export async function drawEntry(
  {
    entryId,
    pin,
    readPage,
    l,
  }: {
    readonly entryId: string;
    readonly pin: CorpusPin;
    readonly readPage: CorpusPageReader;
    readonly l: Logger;
  },
): Promise<DrawnEntry> {
  /**
   Both sides, absent when this entry carries only one.
   */
  const texts = await readPairTexts({
    entryId,
    pin,
    readPage,
    l,
  },);
  if (texts.kind === 'missing') {
    return {
      picks: [],
      slices: [],
    };
  }

  /**
   Slices exactly as the lanes would see them.
   */
  const prepared = prepareDocumentPair({
    sourceText: texts.source,
    targetText: texts.target,
  },);

  /**
   What the screen makes of their sizes.
   */
  const displacement = classifyDisplacement({
    slices: sliceSizesOf({ slices: prepared.slices, },),
  },);

  /**
   Flagged slices, deduplicated across overlapping candidates.
   */
  const flagged = flaggedSlices({
    entryId,
    displacement,
  },);
  if (flagged.length === 0) {
    return {
      picks: [],
      slices: prepared.slices,
    };
  }

  return {
    // CONTROLS ONLY FROM ENTRIES THAT CONTRIBUTE FLAGGED SLICES, so the two
    // populations share their documents. A control drawn from an entry the
    // screen never flagged would differ in whatever made that entry clean.
    picks: [
      ...flagged,
      ...controlSlices({
        entryId,
        displacement,
        wanted: CONTROLS_PER_ENTRY,
      },),
    ],
    slices: prepared.slices,
  };
}

//endregion Window trial probe draw
