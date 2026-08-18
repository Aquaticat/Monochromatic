import { readFile, } from 'node:fs/promises';

import type { ArtifactDeliveryRowV2, } from './artifact-v2-vocabulary.ts';
import { parseSettledArtifactV2, } from './artifact-v2-read.ts';

//region Damage regions, version 2
// EVERY REGION WHERE THIS PIPELINE SHIPPED REPLACEMENT TEXT, read out of the
// version 2 delivery ledger.
//
// WHY THIS EXISTS: `damage-sample.ts` drew from a top-level `issues[]`, which
// version 2 artifacts do not have, so the draw failed outright on the pool
// settled 2026-08-17 with
// `artifact parse failed at artifact Acheron.issues: expected an array`.
//
// MOVING THE FIELD READ WOULD HAVE BEEN THE WRONG FIX, and quietly so. Version 2
// runs two lanes and BOTH of them ship replacement text. On `Acheron` the repair
// lane ships 3 replacements and the translate lane ships 4, so a draw reading
// only the repair lane's issues would cover 3 of the 7 regions where text was
// actually replaced, while describing itself as a draw over the shipped regions.
// Nothing in its output would show the shortfall.
//
// THE POPULATION IS DETERMINED BY THE QUESTION rather than chosen. The damage
// question is whether an edit damaged the text, and it is answerable exactly
// where a row carries both what was there before and what shipped instead. Every
// `replacement-shipped` row carries both, in either lane, so both lanes belong
// and the lane is recorded per row so a reader can still separate them.
//
// THE ARTIFACT'S OWN TEXT IS USED, never a fresh slicing of the corpus, for the
// reason `#115` settled: re-sliced text is a different input from the one the
// judges saw, so a sheet built from it would ask about something the pipeline
// never produced. It also removes the old draw's unplaceable-region failure,
// where a region survived the draw and then could not be located again.

/**
 * Lanes a damage draw ranges over, in the order a pass runs them.
 */
export const DAMAGE_LANES = [
  'repair',
  'translate',
] as const;

/**
 * Lane one shipped region came from.
 */
export type DamageLane = typeof DAMAGE_LANES[number];

/**
 * One region where a lane shipped replacement text.
 *
 * @example
 * ```ts
 * const region: ShippedRegionV2 = {
 *   entryId: 'Tabby',
 *   lane: 'repair',
 *   chunkIndex: 2,
 *   regionId: 'repair#2',
 *   sourceText: '猫',
 *   incumbentText: 'the cat',
 *   shippedText: 'the tabby',
 * };
 * ```
 */
export type ShippedRegionV2 = {
  /**
   * Corpus entry the region belongs to.
   */
  readonly entryId: string;

  /**
   * Lane that shipped it, kept because the two answer different questions and
   * pooling them without a label would make them impossible to separate later.
   */
  readonly lane: DamageLane;

  /**
   * Slice within the preparation both lanes ran over.
   */
  readonly chunkIndex: number;

  /**
   * Stable identity within an entry, which the draw digests and the sheet
   * shows. Version 1 had an envelope id here; version 2 addresses a slice by
   * lane and index instead, and one slice can be shipped by both lanes.
   */
  readonly regionId: string;

  /**
   * Original passage, as the judges were shown it.
   */
  readonly sourceText: string;

  /**
   * Wording that was there before, which is what an edit could have damaged.
   */
  readonly incumbentText: string;

  /**
   * Wording that shipped instead.
   */
  readonly shippedText: string;
};

/**
 * What one pool of artifacts held.
 *
 * THE SKIPPED COUNT IS REPORTED RATHER THAN DROPPED. A slice whose incumbent is
 * absent was filled where the archive had no English at all, so nothing was
 * replaced and no edit could have damaged anything: the honest question there is
 * whether the rendering is correct, which is a different sheet. Counting them
 * keeps that visible instead of letting the pool look smaller than the run.
 *
 * @example
 * ```ts
 * const census: ShippedRegionCensus = { regions: [], filledWithoutIncumbent: 0, };
 * ```
 */
export type ShippedRegionCensus = {
  /**
   * Regions the damage question can be asked about.
   */
  readonly regions: readonly ShippedRegionV2[];

  /**
   * Rows that shipped into a passage with no incumbent wording.
   */
  readonly filledWithoutIncumbent: number;
};

/**
 * Builds a region's identity within its entry.
 *
 * @param lane - lane that shipped it
 *
 * @param chunkIndex - slice index
 *
 * @returns Identity, stable across runs of one pipeline
 *
 * @example
 * ```ts
 * const id = regionIdOf({ lane: 'translate', chunkIndex: 4, },);
 * ```
 */
export function regionIdOf(
  {
    lane,
    chunkIndex,
  }: {
    readonly lane: DamageLane;
    readonly chunkIndex: number;
  },
): string {
  return `${lane}#${String(chunkIndex,)}`;
}

/**
 * Turns one lane's delivery ledger into the regions a damage draw can use.
 *
 * EXPORTED FOR ITS TESTS, per `XPT`. Every judgement this module makes lives
 * here: which rows count, which are set aside, and what identifies one. The
 * reader around it only lists files and hands them to a parser that has its own
 * tests, so testing it through the filesystem would exercise that parser again
 * and this decision once.
 *
 * @param entryId - corpus entry
 *
 * @param lane - lane the rows came from
 *
 * @param rows - that lane's delivery ledger
 *
 * @returns Regions, and how many rows had no incumbent to damage
 *
 * @example
 * ```ts
 * const found = regionsOfLane({ entryId, lane: 'repair', rows, },);
 * ```
 */
export function regionsOfLane(
  {
    entryId,
    lane,
    rows,
  }: {
    readonly entryId: string;
    readonly lane: DamageLane;
    readonly rows: readonly ArtifactDeliveryRowV2[];
  },
): ShippedRegionCensus {
  /**
   * Rows where this lane's wording replaced something.
   */
  const shipped = rows.filter(function wasShipped(row,): boolean {
    /**
     * What the lane did with this slice.
     */
    const { delivery, } = row;
    return delivery.kind === 'replacement-shipped';
  },);

  /**
   * Of those, the ones that replaced actual wording rather than filling a gap.
   */
  const replaced = shipped.filter(function hadIncumbent(row,): boolean {
    return row.incumbentKind === 'present';
  },);

  return {
    regions: replaced.map(function toRegion(row,): ShippedRegionV2 {
      return {
        entryId,
        lane,
        chunkIndex: row.chunkIndex,
        regionId: regionIdOf({
          lane,
          chunkIndex: row.chunkIndex,
        },),
        sourceText: row.sourceText,
        incumbentText: row.incumbentText,
        shippedText: row.shippedText,
      };
    },),
    filledWithoutIncumbent: shipped.length - replaced.length,
  };
}

/**
 * Reads every shipped region out of a pool of version 2 artifacts.
 *
 * ONE FILE AT A TIME, on purpose: an artifact runs to hundreds of kilobytes and
 * holding a whole pool open at once buys nothing a sequential read does not.
 *
 * @param artifactsDir - directory the settled artifacts sit in
 *
 * @param files - artifact file names already filtered to the eligible pool
 *
 * @returns Every region the damage question can be asked about, entry order
 *
 * @throws {@link ArtifactParseError} when an artifact is malformed
 *
 * @example
 * ```ts
 * const census = await collectShippedRegionsV2({ artifactsDir, files, },);
 * ```
 */
export async function collectShippedRegionsV2(
  {
    artifactsDir,
    files,
  }: {
    readonly artifactsDir: string;
    readonly files: readonly string[];
  },
): Promise<ShippedRegionCensus> {
  /**
   * Regions gathered so far.
   */
  const found: ShippedRegionV2[] = [];

  /**
   * Rows that filled a passage having no incumbent wording.
   */
  const skipped = { count: 0, };

  /* oxlint-disable no-await-in-loop -- sequential on purpose: one artifact at a time keeps peak memory flat across a pool */
  for (const file of files) {
    /**
     * Entry id, which is the artifact's own file name.
     */
    const entryId = file.slice(
      0,
      -'.json'.length,
    );

    /**
     * Artifact, parsed by version 2's own reader so its invariants are checked
     * here rather than assumed.
     */
    const artifact = parseSettledArtifactV2({
      value: JSON.parse(await readFile(
        `${artifactsDir}/${file}`,
        'utf8',
      ),),
    },);

    DAMAGE_LANES.forEach(function perLane(lane,): void {
      /**
       * This lane as the parser read it.
       */
      const laneRead = artifact.lanes[lane];

      /**
       * What this lane delivered.
       */
      const census = regionsOfLane({
        entryId,
        lane,
        rows: laneRead.delivery,
      },);
      found.push(...census.regions,);
      skipped.count += census.filledWithoutIncumbent;
    },);
  }
  /* oxlint-enable no-await-in-loop */

  return {
    regions: found,
    filledWithoutIncumbent: skipped.count,
  };
}

//endregion Damage regions, version 2
