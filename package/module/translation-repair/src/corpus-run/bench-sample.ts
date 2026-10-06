import { resolveRealGit as resolveGit, } from '@monochromatic-dev/git-executable/ts';
import { alignDocumentSections, } from '../chunk-document.ts';
import { wholeOpening, } from '../code-points.ts';
import {
  type CorpusPin,
  listCorpusPeople,
  readCorpusFile,
} from '../corpus-source.ts';
import { wordForCount, } from '../count-word.ts';
import { isLineStructured, } from '../line-structure.ts';
import { parseDocument, } from '../parse-document.ts';
import { subdivideChunkPair, } from '../slice-pair.ts';
import { StatedRefusalError, } from '../stated-refusal.ts';
import { pickSpreadSample, } from './bench-draw.ts';

//region Bench sample
// The slices a roster-width bench runs, drawn the same way every time.
//
// Deterministic because the whole point is comparing widths: if each width saw
// a different sample, the decline rates would differ by sample and nothing
// could be read off the comparison. The draw is a stride over slices ordered by
// SOURCE SIZE, which spreads the sample across the size range rather than
// concentrating it wherever the corpus happens to be dense.
//
// Spends no quota. Reads the pinned corpus only.

/**
 Most UTF-16 units of a read failure kept when an entry is skipped, enough to
 name the missing side without printing a stack per entry; the cut ends on a
 whole character (`wholeOpening`).
 */
const SKIP_DETAIL_CHARS = 80;

/**
 One slice the bench translates, with the facts a stage call needs.

 @example
 ```ts
 const slice: BenchSlice = { entryId: 'Mittens', index: 3, ... };
 ```

 @internal
 */
export type BenchSlice = {
  /**
   Entry this slice was cut from.
   */
  readonly entryId: string;

  /**
   Position within that entry's slices, so a row can be traced back.
   */
  readonly index: number;

  /**
   Original passage to render.
   */
  readonly sourceText: string;

  /**
   Translation as it stands, blank when the archive has none here.
   */
  readonly incumbentText: string;

  /**
   Whether the line-structure rule governs this slice, inherited from its
   chunk exactly as `repairTranslation` inherits it.
   */
  readonly lineStructured: boolean;
};

/**
 Cuts one entry into slices, or returns none when either side is unreadable.

 @param entryId - corpus entry

 @returns Every slice of that entry

 @example
 ```ts
 const slices = await sliceEntry({ entryId: 'Mittens', pin, },);
 ```
 */
async function sliceEntry(
  {
    entryId,
    pin,
  }: {
    readonly entryId: string;
    readonly pin: CorpusPin;
  },
): Promise<readonly BenchSlice[]> {
  /**
   Both sides at the pin; an entry missing either is simply not sampled.
   */
  const [sourceText, targetText,] = await Promise.all([
    readCorpusFile({
      pin,
      relPath: `people/${entryId}/page.md`,
    },),
    readCorpusFile({
      pin,
      relPath: `people/${entryId}/page.en.md`,
    },),
  ],);

  /**
   Aligned sections, exactly as the pipeline pairs them.
   */
  const alignment = alignDocumentSections({
    source: parseDocument({ text: sourceText, },),
    target: parseDocument({ text: targetText, },),
  },);

  /**
   Slices accumulated across this entry's sections.
   */
  const slices: BenchSlice[] = [];
  for (const pair of alignment.pairs) {
    /**
     Whether the whole section reads as line-structured, which its slices
     inherit.
     */
    const chunkGoverns = isLineStructured({ text: pair.source
      .text, },);
    for (
      const slice of subdivideChunkPair({
        pair,
        sourceText,
        targetText,
        baseIndex: slices.length,
      },)
    ) {
      slices.push({
        entryId,
        index: slices.length,
        sourceText: slice.source
          .text,
        incumbentText: slice.target
          .text,
        lineStructured: chunkGoverns
          || isLineStructured({ text: slice.source
            .text, },),
      },);
    }
  }

  return slices;
}

/**
 Draws the bench sample across the whole pinned corpus.

 @param count - slices wanted; fewer come back only when the corpus holds
 fewer

 @param pin - corpus clone and commit to read: `RUN_CORPUS_PIN` in a run, a
 throwaway clone in a test, since the real one is unlicensed. REQUIRED: a
 default read the clone for any caller that left it out (ledger M43, X24)

 @returns Sample ordered by source size, smallest first

 @throws {@link StatedRefusalError} when the pinned corpus yields no slice at
 all, since a bench drawn over nothing would report widths as
 indistinguishable while having compared them on no work

 @example
 ```ts
 const sample = await sampleBenchSlices({ count: 12, pin: RUN_CORPUS_PIN, },);
 ```

 @internal
 */
export async function sampleBenchSlices(
  {
    count,
    pin,
  }: {
    readonly count: number;
    readonly pin: CorpusPin;
  },
): Promise<readonly BenchSlice[]> {
  /**
   Own the batch's revision and resolve its native executable before concurrent reads.
   Self-shim detection decodes candidate files; repeating it per page can exhaust the heap.
   */
  const resolvedPin: CorpusPin = {
    ...pin,
    gitPath: pin.gitPath ?? await resolveGit(),
  };
  /**
   Entries at the pin, in the order the corpus lists them.
   */
  const entryIds = await listCorpusPeople({ pin: resolvedPin, },);

  /**
   Every entry sliced, or reported as unreadable.

   An entry missing one side is not a bench failure: the census reports the
   same gap, and refusing to draw a sample over it would make the bench depend
   on corpus completeness it does not need.
   */
  const sliced = await Promise.all(
    entryIds.map(async function sliceOne(entryId,): Promise<readonly BenchSlice[]> {
      try {
        return await sliceEntry({
          entryId,
          pin: resolvedPin,
        },);
      }
      catch (error) {
        /**
         Why this entry could not be sliced, trimmed for one log line.
         */
        const detail = wholeOpening({
          text: String(error,),
          units: SKIP_DETAIL_CHARS,
        },);
        console.log(`BENCH skipping ${entryId}: ${detail}`,);
        return [];
      }
    },),
  );

  /**
   Every slice of every readable entry.
   */
  const all = sliced.flat();
  // A STATED REFUSAL, since the remedy is the operator's: the clone or the
  // commit the run reads is not the corpus they meant. As a plain error both
  // commands that draw here printed it as a fault in themselves, at exit 5
  // under frames.
  if (all.length === 0) {
    throw new StatedRefusalError({
      says: `the corpus at the pin yields no slice to sample: ${String(entryIds.length,)} ${
        wordForCount({
          count: entryIds.length,
          one: 'entry is',
          many: 'entries are',
        },)
      } listed there and none could be sliced, so a bench drawn over it would compare on no work; check the `
        + 'clone and the commit this run reads',
    },);
  }

  return pickSpreadSample({
    slices: all,
    count,
  },);
}

//endregion Bench sample
