import { readFile, } from 'node:fs/promises';

import {
  requireArray,
  requireRecord,
  requireString,
} from '../artifact-guard.ts';
import {
  type GradedItem,
  parseGradedSheet,
} from '../grade-sheet-read.ts';
import { resolveRunsDir, } from './run-config.ts';

//region Score verify
// Joins the blind verification grades to the manifest that says which set each
// item came from, and reports what the unlabelled probe's flags are worth.
//
// The join is BY POSITION, the same as every other sheet here, because the
// sheet prints no ids on purpose. The manifest is written in the same instant
// as the sheet by `probe-verify.ts`, from one ordering, so position is exact
// rather than assumed.
//
// What the numbers mean. A flag on a region a reader already called damaged is
// the probe agreeing with a known answer, which measures little. A flag on a
// region nobody had read is the whole question: graded Y it is damage the
// sample missed, and graded N it is an invention, and the split between them is
// the precision any gating decision has to live with.

/**
 * One manifest row, naming what the sheet deliberately hides.
 */
type VerifyManifestItem = {
  /**
   * One-based position, matching the sheet.
   */
  readonly position: number;

  /**
   * Corpus entry the region belongs to.
   */
  readonly entryId: string;

  /**
   * Which set the region came from.
   */
  readonly kind: string;
};

/**
 * Reads the manifest written beside the sheet.
 *
 * @param path - manifest path
 *
 * @returns Rows in sheet order
 *
 * @throws {@link ArtifactParseError} when a field is malformed
 *
 * @example
 * ```ts
 * const rows = await readVerifyManifest({ path, },);
 * ```
 */
async function readVerifyManifest(
  { path, }: { readonly path: string; },
): Promise<readonly VerifyManifestItem[]> {
  /**
   * Manifest as a record.
   */
  const manifest = requireRecord({
    value: JSON.parse(await readFile(
      path,
      'utf8',
    ),),
    path: 'verify manifest',
  },);

  return requireArray({
    value: manifest.items,
    path: 'verify manifest.items',
  },)
    .map(function toItem(
      value,
      index,
    ): VerifyManifestItem {
      /**
       * Row as a record.
       */
      const row = requireRecord({
        value,
        path: 'verify manifest.items[]',
      },);

      /**
       * Position as written, checked against its own index so a reordered
       * manifest cannot mislabel every verdict silently.
       */
      const { position, } = row;
      if (position !== (index + 1)) {
        throw new Error(
          `verify manifest item ${String(index + 1,)} carries position ${
            JSON.stringify(position,)
          }, so the file is not in sheet order and a positional join would mislabel every grade`,
        );
      }

      return {
        position: index + 1,
        entryId: requireString({
          value: row.entryId,
          path: 'verify manifest.items[].entryId',
        },),
        kind: requireString({
          value: row.kind,
          path: 'verify manifest.items[].kind',
        },),
      };
    },);
}

/**
 * Width the set name is padded to, so the two report lines align.
 */
const KIND_COLUMN_WIDTH = 8;

/**
 * Decimal places a precision figure carries.
 */
const PRECISION_DIGITS = 3;

/**
 * Counts of one set's graded flags.
 */
type KindTally = {
  /**
   * Flags the reader called real damage.
   */
  damage: number;

  /**
   * Flags the reader rejected.
   */
  invented: number;

  /**
   * Items left ungraded.
   */
  unscored: number;
};

/**
 * Adds one graded item to its set's tally.
 *
 * @param tally - tally to add into
 *
 * @param item - graded sheet item
 *
 * @example
 * ```ts
 * addGrade({ tally, item, },);
 * ```
 */
function addGrade(
  {
    tally,
    item,
  }: {
    readonly tally: KindTally;
    readonly item: GradedItem;
  },
): void {
  if (item.verdict === 'real-defect') {
    tally.damage += 1;
    return;
  }
  if (item.verdict === 'false-positive') {
    tally.invented += 1;
    return;
  }
  tally.unscored += 1;
}

/**
 * Reports what the graded sheet says about the unlabelled probe.
 *
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  /**
   * Run artifact root for this checkout.
   */
  const dir = await resolveRunsDir();

  /**
   * Graded sheet items, in sheet order.
   */
  const graded = parseGradedSheet({
    text: await readFile(
      `${dir}/probe-verify-sheet.md`,
      'utf8',
    ),
  },);

  /**
   * Manifest rows, in the same order.
   */
  const manifest = await readVerifyManifest({
    path: `${dir}/probe-verify-manifest.json`,
  },);
  if (graded.length !== manifest.length) {
    throw new Error(
      `sheet carries ${String(graded.length,)} items and manifest carries ${
        String(manifest.length,)
      }; a positional join between them would mislabel verdicts, so neither file describes the other`,
    );
  }

  /**
   * Tally per set.
   */
  const tallies: Readonly<Record<string, KindTally>> = {
    damaged: {
      damage: 0,
      invented: 0,
      unscored: 0,
    },
    control: {
      damage: 0,
      invented: 0,
      unscored: 0,
    },
  };

  for (const [index, item,] of graded.entries()) {
    /**
     * Manifest row for this position.
     */
    const row = manifest[index];
    if (row === undefined)
      continue;

    /**
     * Tally this row belongs to.
     */
    const tally = tallies[row.kind];
    if (tally === undefined)
      continue;

    addGrade({
      tally,
      item,
    },);
  }

  for (const [kind, tally,] of Object.entries(tallies,)) {
    /**
     * Flags this set contributed that carry a verdict.
     */
    const scored = tally.damage + tally.invented;
    console.log(
      `${kind.padEnd(KIND_COLUMN_WIDTH,)} flags=${
        String(scored + tally.unscored,)
      } realDamage=${String(tally.damage,)} invented=${
        String(tally.invented,)
      } unscored=${String(tally.unscored,)} precision=${
        scored === 0 ? 'n/a' : (tally.damage / scored).toFixed(PRECISION_DIGITS,)
      }`,
    );
  }

  console.log(
    'NOTE the control line is the one that decides gating. Its precision is '
      + 'what a gate would pay for on regions nobody had read, and the damaged '
      + 'line only confirms the probe agrees where the answer was already '
      + 'known.',
  );
}

await main();

//endregion Score verify
