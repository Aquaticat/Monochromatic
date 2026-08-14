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

  for (
    const {
      arm,
      proposers,
    } of items
  ) {
    /**
     * Whether one author raised this claim alone, computed once per claim
     * rather than once per author of it.
     */
    const soleAuthored = proposers.length === 1;
    for (const modelId of proposers) {
      /**
       * This author's row, created on first sight.
       */
      const row = rows.get(modelId,) ?? {
        accepted: 0,
        control: 0,
        sole: 0,
      };
      // Only the two arms a rate is computed over are counted here. An
      // `undecided` claim belongs to neither, and adding it to control would
      // put the panel's non-verdicts into a column read as rejections.
      if (arm === 'accepted')
        row.accepted += 1;
      else if (arm === 'control')
        row.control += 1;
      if (soleAuthored)
        row.sole += 1;
      rows.set(
        modelId,
        row,
      );
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
    .toSorted(function byAccepted(
      left,
      right,
    ): number {
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

  // NAMES THE RUN IT READ, first line, always. `resolveRunsDir` falls back to a
  // default when TRANSLATION_REPAIR_RUNS_DIR is unset, so a report can describe
  // a different run than the reader has in mind and every count below will look
  // like an answer about theirs. Pointing this at the wrong directory produced a
  // clean set of zeros that read as "nothing to report" rather than as "wrong
  // run", which is the failure this whole project keeps rediscovering.
  console.log(`SOURCE ${artifactsDir}`,);

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
   * Judgeable and unjudgeable claims, bound to names so counting them reads as
   * one member step rather than as a chain through the census.
   */
  const {
    items,
    unjudgeable,
  } = census;

  /**
   * Claims per arm, counted separately because `undecided` belongs in no rate.
   */
  const accepted = items
    .filter(function isAccepted({ arm, },): boolean {
      return arm === 'accepted';
    },);

  /**
   * Claims the panel decided against, the only legitimate control.
   */
  const control = items
    .filter(function isControl({ arm, },): boolean {
      return arm === 'control';
    },);

  /**
   * Claims the panel declined to decide, held out of every rate.
   */
  const undecided = items
    .filter(function isUndecided({ arm, },): boolean {
      return arm === 'undecided';
    },);

  console.log(
    `POPULATION entries=${String(census.entriesCovered,)} `
      + `withoutAttribution=${String(census.entriesWithoutAttribution,)} `
      + `judgeable=${String(items.length,)} `
      + `unjudgeable=${String(unjudgeable.length,)} `
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
      + `control=${String(control.length,)} `
      + `undecided=${String(undecided.length,)}`,
  );
  console.log(
    'NOTE undecided is needs-human, held OUT of every rate rather than filed '
      + 'as control. Rejected means the panel decided against a claim, so a '
      + 'judge can agree or disagree with it; needs-human means the panel '
      + 'declined to decide, and agreement with a verdict never given is '
      + 'undefined. Those claims lean supported on this run, so folding them '
      + 'into control would fill it with claims the panel mostly believed.',
  );

  if (items.length === 0) {
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
  for (
    const { status, } of [
      ...control,
      ...undecided,
    ]
  )
    byStatus[status] = (byStatus[status] ?? 0) + 1;
  console.log(
    `NON-ACCEPTED BY STATUS ${
      Object
        .entries(byStatus,)
        .map(function toPair([status, count,],): string {
          return `${status}=${String(count,)}`;
        },)
        .join(' ',)
    }`,
  );

  console.log(`\n${headerLine()}`,);
  for (const row of tallyAuthors({ items, },))
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
  if (unjudgeable.length > 0) {
    console.log(
      `WARNING ${String(unjudgeable.length,)} claims were proposed by `
        + 'the WHOLE roster, so nobody may judge them. They are reported here '
        + 'rather than dropped: they are the most corroborated claims in the '
        + 'run, and removing them would lift every rate by hiding exactly the '
        + 'strongest agreement in the population.',
    );
  }
}

await main();

//endregion Score crosscheck
