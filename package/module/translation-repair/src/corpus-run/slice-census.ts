import {
  CorpusReadError,
  listCorpusPeople,
} from '../corpus-source.ts';
import {
  describeSpread,
  REPORTED_PERCENTILES,
} from './census-spread.ts';
import {
  resolveRunsDir,
  RUN_CORPUS_PIN,
} from './run-config.ts';
import { readSettledRecipe, } from './settled-carve.ts';
import {
  censusEntry,
  type EntryCensus,
} from './slice-census-entry.ts';
import { reportingRefusals, } from './cli-refusal.ts';

//region Slice census
// What the corpus looks like AFTER slicing, measured rather than assumed, and
// spending no quota.
//
// Three questions need this and none of them could be answered from the code:
//
//   How many calls a translate lane costs, which is slices times producers, and
//   how large the largest of them is. `RUN_PER_CALL_TIMEOUT_MS` was tuned
//   against repair envelopes averaging 72 characters, and this lane sends whole
//   slices.
//
//   How much of the corpus reaches the lane as a section only ONE side carries,
//   which subdivision returns whole. Those are the calls that time out.
//
//   How much text sits in TARGET-ONLY blocks, the class where the English
//   carries something the Chinese markdown does not, letters held as images
//   being the known case. A translator working from the source has no source for
//   it, so whether it can be detected deterministically decides whether it can
//   be protected.

/**
 * Size at which a translate call is known to be at risk.
 *
 * The translate probe asked for a 4641-character section in one call and lost
 * two voices of three: one timed out at six minutes, one returned
 * schema-invalid output. That is the only measured point on this curve, so it
 * is the threshold rather than a round number.
 */
const PROBE_TIMEOUT_CHARS = 4_641;

/**
 * How many entries the unpaired-section list names, which is enough to show
 * whether that text is one outlier or spread across the corpus.
 */
const UNPAIRED_ENTRIES_LISTED = 5;


/**
 * Counts the rows whose sizes describe one carve.
 *
 * @param rows - census rows
 *
 * @param carve - carve to count
 *
 * @returns How many rows carry it
 *
 * @example
 * ```ts
 * const complete = countCarve({ rows, carve: 'settled-complete', },);
 * ```
 */
function countCarve(
  {
    rows,
    carve,
  }: {
    readonly rows: readonly EntryCensus[];
    readonly carve: EntryCensus['carve'];
  },
): number {
  return rows
    .filter(function carries(row,): boolean {
      return row.carve === carve;
    },)
    .length;
}

/**
 * One entry with the largest single slice it produced.
 *
 * Named rather than inferred, because an inferred object literal carries
 * writable properties and the comparator that sorts these then takes mutable
 * parameters it never mutates.
 *
 * @example
 * ```ts
 * const widest: WidestSlice = { entryId: 'shihai4h', largest: 10_959, };
 * ```
 */
type WidestSlice = Readonly<{
  /**
   * Corpus id.
   */
  entryId: string;

  /**
   * Characters in its largest slice, on either side.
   */
  largest: number;
}>;

/**
 * Measures every complete pair at the pin and prints the census.
 *
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  /**
   * Every corpus id at the pinned commit.
   */
  const entryIds = await listCorpusPeople({ pin: RUN_CORPUS_PIN, },);

  /**
   * Entries that carry both sides, measured.
   */
  const rows: EntryCensus[] = [];

  /**
   * Ids missing one side, which is ordinary rather than a fault.
   */
  const incomplete: string[] = [];
  /**
   * Runs directory whose settled artifacts carry each entry's recipe.
   */
  const runsDir = await resolveRunsDir();

  /**
   * Entries whose artifact predates the recipe, carved deterministically.
   */
  const legacy: string[] = [];
  for (const entryId of entryIds) {
    /**
     * Recipe the entry's settled artifact records, if any.
     */
    /* oxlint-disable-next-line no-await-in-loop -- sequential by design: this reads git at a pinned commit and a fan-out would only contend for the same object store */
    const settled = await readSettledRecipe({
      entryId,
      runsDir,
    },);
    if (settled.kind === 'legacy')
      legacy.push(entryId,);
    try {
      /* oxlint-disable-next-line no-await-in-loop -- sequential by design: this reads git at a pinned commit and a fan-out would only contend for the same object store */
      rows.push(await censusEntry({
        entryId,
        ...((settled.kind === 'settled')
          ? {
            pin: {
              cloneDir: RUN_CORPUS_PIN.cloneDir,
              commitSha: settled.corpusSha,
            },
            recipe: settled.recipe,
          }
          : {}),
      },),);
    }
    catch (error) {
      // A missing translation is the ordinary shape of an incomplete pair, and
      // the corpus has them. Anything else keeps propagating.
      if (!(error instanceof CorpusReadError))
        throw error;
      incomplete.push(entryId,);
    }
  }

  /**
   * Every slice's source characters, corpus-wide.
   */
  const sourceChars = rows.flatMap(function toSourceChars(row,) {
    return [...row.sliceSourceChars,];
  },);

  /**
   * Every slice's target characters.
   */
  const targetChars = rows.flatMap(function toTargetChars(row,) {
    return [...row.sliceTargetChars,];
  },);
  console.log(
    `CENSUS ${String(rows.length,)} complete pairs, ${
      String(incomplete.length,)
    } incomplete, ${String(sourceChars.length,)} slices`,
  );

  /**
   * Rows by which carve their sizes describe.
   */
  const carved = {
    complete: countCarve({
      rows,
      carve: 'settled-complete',
    },),
    partial: countCarve({
      rows,
      carve: 'settled-partial',
    },),
    deterministic: countCarve({
      rows,
      carve: 'deterministic',
    },),
  };
  // WHICH SLICING THE SIZES DESCRIBE, said before any size is. A settled entry
  // is carved through its artifact's recipe, so its slices are the ones the
  // lanes judged; an entry no artifact records is carved by the deterministic
  // aligner, which is a baseline the pass no longer runs, and a reader sizing
  // a lane over these numbers needs to know how many rows are which.
  console.log(
    `CENSUS carve: ${String(carved.complete,)} settled entries with a complete recipe, ${
      String(carved.partial,)
    } settled with a defaulted half, ${String(carved.deterministic,)} deterministic baseline (${
      String(legacy.length,)
    } of those hold a legacy artifact)`,
  );
  console.log(describeSpread({
    label: 'CENSUS slice source chars',
    values: sourceChars,
  },),);
  console.log(describeSpread({
    label: 'CENSUS slice target chars',
    values: targetChars,
  },),);

  /**
   * Entries carrying a section the aligner would not pair, on either side.
   */
  const unpaired = rows.filter(function hasUnpaired(row,) {
    return (row.unpairedSourceSections > 0)
      || (row.unpairedTargetSections > 0);
  },);
  console.log(
    `CENSUS unpaired sections: ${
      String(unpaired.reduce(
        function addSourceSections(
        sum,
        row,
      ) {
        return sum + row.unpairedSourceSections;
      },
        0,
      ),)
    } source and ${
      String(unpaired.reduce(
        function addTargetSections(
        sum,
        row,
      ) {
        return sum + row.unpairedTargetSections;
      },
        0,
      ),)
    } target, across ${String(unpaired.length,)} entries, ${
      String(unpaired.reduce(
        function addSourceChars(
        sum,
        row,
      ) {
        return sum + row.unpairedSourceChars;
      },
        0,
      ),)
    } source chars and ${
      String(unpaired.reduce(
        function addTargetChars(
        sum,
        row,
      ) {
        return sum + row.unpairedTargetChars;
      },
        0,
      ),)
    } target chars, reaching no slice`,
  );
  for (
    const row of unpaired
      .toSorted(function byUnpairedChars(
        left,
        right,
      ): number {
        return right.unpairedSourceChars - left.unpairedSourceChars;
      },)
      .slice(
        0,
        UNPAIRED_ENTRIES_LISTED,
      )
  ) {
    console.log(
      `CENSUS   ${row.entryId}: ${
        String(row.unpairedSourceSections,)
      } source sections (${String(row.unpairedSourceChars,)} chars), ${
        String(row.unpairedTargetSections,)
      } target sections (${String(row.unpairedTargetChars,)} chars)`,
    );
  }

  /**
   * Entries carrying blocks only the translation has.
   */
  const targetOnly = rows
    .filter(function hasTargetOnly(row,) {
      return row.targetOnlyBlocks > 0;
    },)
    .toSorted(function byChars(
      left,
      right,
    ) {
      return right.targetOnlyChars - left.targetOnlyChars;
    },);
  console.log(
    `CENSUS target-only blocks: ${
      String(targetOnly.reduce(
        function addBlocks(
        sum,
        row,
      ) {
        return sum + row.targetOnlyBlocks;
      },
        0,
      ),)
    } across ${String(targetOnly.length,)} entries, ${
      String(targetOnly.reduce(
        function addChars(
        sum,
        row,
      ) {
        return sum + row.targetOnlyChars;
      },
        0,
      ),)
    } chars`,
  );
  for (const row of targetOnly.slice(
    0,
    REPORTED_PERCENTILES.length,
  )) {
    console.log(
      `CENSUS   ${row.entryId}: ${String(row.targetOnlyBlocks,)} blocks, ${
        String(row.targetOnlyChars,)
      } chars`,
    );
  }
  console.log(describeSpread({
    label: 'CENSUS target-only block chars',
    values: rows.flatMap(function toBlockChars(row,) {
      return [...row.targetOnlyBlockChars,];
    },),
  },),);

  /**
   * Entries ordered by their largest slice, since the tail is what a per-call
   * deadline meets first and a percentile hides which entry owns it.
   */
  const widest = rows
    .map(function toWidest(row,): WidestSlice {
      return {
        entryId: row.entryId,
        largest: Math.max(
          0,
          ...row.sliceTargetChars,
          ...row.sliceSourceChars,
        ),
      };
    },)
    .toSorted(function byLargest(
      left,
      right,
    ) {
      return right.largest - left.largest;
    },);

  /**
   * Slices carrying more than the whole-section call the translate probe
   * already saw time out at six minutes.
   */
  const oversized = rows.flatMap(function toOversized(row,) {
    return row.sliceTargetChars
      .filter(function isLarge(chars,) {
      return chars > PROBE_TIMEOUT_CHARS;
    },);
  },);
  console.log(
    `CENSUS slices over ${String(PROBE_TIMEOUT_CHARS,)} target chars: ${
      String(oversized.length,)
    } of ${String(targetChars.length,)}`,
  );
  for (const row of widest.slice(
    0,
    REPORTED_PERCENTILES.length,
  )) {
    console.log(
      `CENSUS   widest ${row.entryId}: ${String(row.largest,)} chars in one slice`,
    );
  }
}

// Guarded so this runs only when INVOKED, never as an import side effect.
if (import.meta.main)
  await reportingRefusals({
    what: 'slice-census',
    run: main,
  },);

//endregion Slice census
