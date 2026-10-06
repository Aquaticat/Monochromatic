import {
  type CorpusPin,
  listCorpusPeople,
} from '../corpus-source.ts';
import type { AttemptMap, } from './attempt-store.ts';
import { askedAmong, } from './command-flags.ts';
import type { CommandLineOf, } from './command-lines.ts';
import {
  passIncompleteLine,
  passOnlyLines,
} from './corpus-pass-lines.ts';
import { orderPendingEntries, } from './corpus-pass-order.ts';
import { readOnlyIds, } from './entry-filter.ts';
import { collectEligiblePairs, } from './pass-eligibility.ts';
import type { CorpusPair, } from './pass-entry-contract.ts';
import { listResumableEntries, } from './slice-cache-store.ts';

//region Corpus pass select
// Which entries a pass runs and in what order, with what it could not pair said
// on the way.

/**
 Chooses the entries a pass runs: every complete unsettled pair at the pin, or
 only those the command line names, ordered to resume cached progress first.

 @param line - the pass's command line, which may restrict the entries

 @param pin - clone and commit the corpus is read at

 @param done - entries already carrying an artifact or a decline record

 @param attempts - attempt counts from earlier runs

 @param sliceCacheDir - root of the per-entry slice caches, where cached progress is found

 @returns The pairs to run, in run order

 @throws {@link StatedRefusalError} when `--only` names an entry the corpus does not hold or names none

 @example
 ```ts
 const pending = await selectPendingEntries({ line, pin, done, attempts, sliceCacheDir, },);
 ```
 */
export async function selectPendingEntries(
  {
    line,
    pin,
    done,
    attempts,
    sliceCacheDir,
  }: {
    readonly line: CommandLineOf<'corpus-pass'>;
    readonly pin: CorpusPin;
    readonly done: ReadonlySet<string>;
    readonly attempts: AttemptMap;
    readonly sliceCacheDir: string;
  },
): Promise<readonly CorpusPair[]> {
  /**
   Every person id at the pinned commit.
   */
  const people = await listCorpusPeople({ pin, },);

  /**
   Entry ids this invocation is restricted to, empty when unrestricted.
   */
  const onlyIds = readOnlyIds({ line, },);

  for (const onlyLine of passOnlyLines({ onlyIds, },))
    console.log(onlyLine,);

  /**
   Complete unsettled pairs, already-settled sizes (ordering needs these:
   ranking runs over the REMAINING entries, so without knowing what each band
   already settled every run would restart each band at rank zero), and the
   entries missing a side at the pin.

   ONLY A MISSING OBJECT DROPS OUT, and it is printed. Any other read
   failure propagates: until 2026-08-26 every read failure read as the
   expected missing side, so a clone that had gone away shrank the corpus
   to nothing without a line saying so.
   */
  const {
    eligible,
    settled,
    incomplete,
  } = await collectEligiblePairs({
    ids: askedAmong({
      asked: [...onlyIds,],
      known: people,
      source: '--only',
      within: 'the corpus at the pin',
    },),
    done,
    pin,
  },);
  for (const gap of incomplete)
    console.log(passIncompleteLine({ gap, },),);

  /**
   Ids with cached slices from an earlier aborted run. These resume first so
   an in-flight large document finishes before a fresh entry starts, rather
   than every large entry taking one partial attempt while none settles.

   NO PROGRESS GUARANTEE IS CLAIMED HERE, and one used to be: this said a
   cap-abort always completes at least one new slice, which is false. An abort
   can land before the first persistence, and the slices a lane deliberately
   leaves uncached, the unfilled and the unheard, produce no cache entry
   however long they took. What actually bounds it is that a stuck entry
   surfaces: `repairChunk` degrades and persists rather than throwing on a
   lost quorum, the translate lane's refusal counter bounds its retries within
   a slice, and an entry that keeps failing writes a repeated same-entry ERROR
   line across runs, which is read by inspection.
   */
  const resumableIds = await listResumableEntries({ dir: sliceCacheDir, },);

  // In run order (`corpus-pass-order.ts`).
  return orderPendingEntries({
    eligible,
    settled,
    resumableIds,
    attempts,
  },);
}

//endregion Corpus pass select
