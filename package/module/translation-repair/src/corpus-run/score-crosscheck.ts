import { join, } from 'node:path';

import { gatherAttributionEntries, } from './attribution-read.ts';
import {
  buildCrosscheckCensus,
  type CrosscheckItem,
} from './judge-crosscheck.ts';
import { MIN_JUDGED_CLAIMS, } from './judge-independence.ts';
import {
  resolveRunsDir,
  RUN_MODELS,
} from './run-config.ts';

//region Score crosscheck
// Reports the population a judge crosscheck would run over, WITHOUT spending a
// single call. The judging pass itself is expensive and contends with the
// corpus pass for the same per-model slots, so knowing in advance whether the
// population can carry a rate is worth more than starting one and finding out.
//
// Prints no corpus text. Claim ids are hashes and model ids are model ids, so
// this output is safe to paste anywhere the artifacts themselves are not.

/**
 * Column widths of the author table, wide enough that no row runs into its
 * neighbour. Object-literal values, so the numbers stay readable here rather
 * than becoming named constants nobody can picture.
 */
const COLUMN = {
  model: 52,
  accepted: 10,
  control: 9,
  sole: 6,
} as const;

/**
 * One author's share of each arm.
 */
type AuthorRow = {
  /**
   * Model that proposed the claims.
   */
  readonly modelId: string;

  /**
   * Claims of theirs the panel accepted.
   */
  readonly accepted: number;

  /**
   * Claims of theirs the panel did not accept.
   */
  readonly control: number;

  /**
   * Claims they authored alone, across both arms.
   */
  readonly sole: number;
};

/**
 * Tallies each author's claims per arm.
 *
 * Counts a claim once for EVERY author, not once per claim. The question the
 * crosscheck asks is per author, so a claim two critics proposed belongs to
 * both their populations; summing the column therefore exceeds the claim count
 * whenever critics agreed, which on this run they almost never do.
 *
 * @param items - judgeable claims from the census
 *
 * @returns One row per author, most accepted claims first
 *
 * @example
 * ```ts
 * const rows = tallyAuthors({ items, },);
 * ```
 */
function tallyAuthors(
  { items, }: { readonly items: readonly CrosscheckItem[]; },
): readonly AuthorRow[] {
  /**
   * Running counts keyed by model id.
   */
  const rows = new Map<string, {
    accepted: number;
    control: number;
    sole: number;
  }>();

  for (const item of items) {
    for (const modelId of item.proposers) {
      /**
       * This author's row, created on first sight.
       */
      const row = rows.get(modelId,) ?? {
        accepted: 0,
        control: 0,
        sole: 0,
      };
      if (item.arm === 'accepted')
        row.accepted += 1;
      else
        row.control += 1;
      if (item.proposers.length === 1)
        row.sole += 1;
      rows.set(modelId, row,);
    }
  }

  return [...rows.entries(),]
    .map(function toRow([modelId, counts,],): AuthorRow {
      return {
        modelId,
        accepted: counts.accepted,
        control: counts.control,
        sole: counts.sole,
      };
    },)
    .toSorted(function byAccepted(left, right,): number {
      return right.accepted - left.accepted;
    },);
}

/**
 * Renders the author table header.
 *
 * @returns Header line
 *
 * @example
 * ```ts
 * console.log(headerLine(),);
 * ```
 */
function headerLine(): string {
  return [
    'AUTHOR'
      .padEnd(COLUMN.model,),
    'accepted'
      .padStart(COLUMN.accepted,),
    'control'
      .padStart(COLUMN.control,),
    'sole'
      .padStart(COLUMN.sole,),
    '  floor',
  ].join('',);
}

/**
 * Renders one author's row, saying plainly whether each arm can carry a rate.
 *
 * @param row - one author's counts
 *
 * @returns Row line
 *
 * @example
 * ```ts
 * console.log(authorLine({ row, },),);
 * ```
 */
function authorLine({ row, }: { readonly row: AuthorRow; },): string {
  /**
   * Which arms hold enough claims for a rate to be reported over them.
   *
   * Both arms must clear it independently. A crosscheck reports the GAP
   * between them, and a gap is only as trustworthy as its thinner side.
   */
  const clears = [
    (row.accepted >= MIN_JUDGED_CLAIMS) ? 'accepted' : '',
    (row.control >= MIN_JUDGED_CLAIMS) ? 'control' : '',
  ].filter(function isSet(name,): boolean {
    return name !== '';
  },);

  return [
    row.modelId
      .padEnd(COLUMN.model,),
    String(row.accepted,)
      .padStart(COLUMN.accepted,),
    String(row.control,)
      .padStart(COLUMN.control,),
    String(row.sole,)
      .padStart(COLUMN.sole,),
    `  ${(clears.length === 0) ? 'neither' : clears.join('+',)}`,
  ].join('',);
}

/**
 * Reads a run's artifacts and prints the crosscheck population.
 *
 * @example
 * ```ts
 * await main();
 * ```
 */
async function main(): Promise<void> {
  /**
   * Directory this run wrote artifacts into.
   */
  const artifactsDir = join(
    await resolveRunsDir(),
    'artifacts',
  );

  /**
   * Entries that parsed, and the artifacts that did not.
   */
  const {
    entries,
    malformed,
  } = await gatherAttributionEntries({ artifactsDir, },);

  if (malformed.length > 0) {
    console.log(
      `WARNING ${String(malformed.length,)} artifacts could not be read and are `
        + 'in NEITHER population below, so every count is over the rest:',
    );
    for (const failure of malformed)
      console.log(`  ${failure.name}: ${failure.reason}`,);
  }

  /**
   * The enumerated population, both arms.
   */
  const census = buildCrosscheckCensus({
    entries,
    roster: RUN_MODELS.judgeModelIds,
  },);

  /**
   * Claims per arm.
   */
  const accepted = census.items.filter(function isAccepted(item,): boolean {
    return item.arm === 'accepted';
  },);

  console.log(
    `POPULATION entries=${String(census.entriesCovered,)} `
      + `withoutAttribution=${String(census.entriesWithoutAttribution,)} `
      + `judgeable=${String(census.items.length,)} `
      + `unjudgeable=${String(census.unjudgeable.length,)} `
      + `legacyClaims=${String(census.unattributedLegacyClaims,)} `
      + `joinFailures=${String(census.unattributedJoinFailures,)}`,
  );
  if (census.unattributedJoinFailures > 0) {
    console.log(
      `WARNING ${String(census.unattributedJoinFailures,)} claims sit on `
        + 'entries that DO carry attribution yet have no proposer recorded. '
        + 'That is the two records disagreeing about claim identity, not a '
        + 'quiet critic, and it is reported apart from the legacy count so it '
        + 'cannot hide inside an expected number.',
    );
  }
  console.log(
    `ARMS accepted=${String(accepted.length,)} `
      + `control=${String(census.items.length - accepted.length,)}`,
  );

  if (census.items.length === 0) {
    console.log(
      'NOTE no entry carries attribution yet, so no claim can have its author '
        + 'barred and there is nothing to crosscheck. Entries settled before '
        + 'attribution existed record no proposer.',
    );
    return;
  }

  /**
   * Control-arm claims broken down by why the panel refused them.
   */
  const byStatus: Record<string, number> = {};
  for (const item of census.items) {
    if (item.arm === 'accepted')
      continue;
    byStatus[item.status] = (byStatus[item.status] ?? 0) + 1;
  }
  console.log(
    `CONTROL BY STATUS ${
      Object
        .entries(byStatus,)
        .map(function toPair([status, count,],): string {
          return `${status}=${String(count,)}`;
        },)
        .join(' ',)
    }`,
  );

  console.log(`\n${headerLine()}`,);
  for (const row of tallyAuthors({ items: census.items, },))
    console.log(authorLine({ row, },),);

  console.log(
    `\nNOTE the floor column reads against MIN_JUDGED_CLAIMS=${
      String(MIN_JUDGED_CLAIMS,)
    }, which is a provisional guard rather than a calibrated threshold. An `
      + 'author clearing neither arm is not excluded from the run; it simply '
      + 'cannot carry a per-author rate yet.',
  );
  console.log(
    'NOTE this crosscheck can bar a claim\'s AUTHORS and cannot bar its '
      + 'adjudicators: the same six models sit as critics, panel and judges, '
      + 'and the provider serves no seventh. It measures whether a verdict '
      + 'survives being re-asked without its author, never precision.',
  );
  if (census.unjudgeable.length > 0) {
    console.log(
      `WARNING ${String(census.unjudgeable.length,)} claims were proposed by `
        + 'the WHOLE roster, so nobody may judge them. They are reported here '
        + 'rather than dropped: they are the most corroborated claims in the '
        + 'run, and removing them would lift every rate by hiding exactly the '
        + 'strongest agreement in the population.',
    );
  }
}

await main();

//endregion Score crosscheck
