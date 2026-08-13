import { join, } from 'node:path';

import { gatherAttributionEntries, } from './attribution-read.ts';
import {
  buildAttributionReport,
  type CriticTally,
} from './attribution-report.ts';
import { resolveRunsDir, } from './run-config.ts';

//region Score attribution
// Reads critic attribution out of a run's settled artifacts and reports it as
// RATES rather than tallies: what each critic was asked, what it raised, and
// how often an accepted issue rested on it alone.
//
// Prints no corpus text. Claim ids are hashes and model ids are model ids, so
// this output is safe to paste anywhere the artifacts themselves are not.

/**
 * Column widths of the critic table, wide enough that no row runs into its
 * neighbour. Object-literal values, so the width numbers stay readable here
 * rather than becoming named constants nobody can picture.
 */
const COLUMN = {
  model: 42,
  heard: 7,
  raised: 8,
  emitted: 9,
  hits: 7,
  raisedPerChunk: 11,
  hitsPerChunk: 10,
} as const;

/**
 * Digits kept on per-chunk rates.
 *
 * These are RATES, not percentages, and the distinction is not pedantic: one
 * critic can raise many claims in a single chunk, so claims per chunk heard
 * legitimately exceeds one and rendering it as a percentage produced readings
 * like "3400%" the first time this ran.
 */
const RATE_DIGITS = 2;

/**
 * Renders the table header.
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
    'CRITIC'
      .padEnd(COLUMN.model,),
    'heard'
      .padStart(COLUMN.heard,),
    'raised'
      .padStart(COLUMN.raised,),
    'emitted'
      .padStart(COLUMN.emitted,),
    'hits'
      .padStart(COLUMN.hits,),
    'raised/ch'
      .padStart(COLUMN.raisedPerChunk,),
    'hits/ch'
      .padStart(COLUMN.hitsPerChunk,),
  ].join('',);
}

/**
 * Renders one critic's row.
 *
 * Rates divide by chunks HEARD rather than by chunks in the run, so a critic
 * that lost voices on half the run is not read as half as willing to raise a
 * claim.
 *
 * @param critic - tally for one critic
 *
 * @returns Row line
 *
 * @example
 * ```ts
 * console.log(criticLine({ critic, },),);
 * ```
 */
function criticLine(
  {
    critic,
  }: {
    readonly critic: CriticTally;
  },
): string {
  /**
   * Claims raised per chunk this critic was heard on.
   */
  const raisedPerChunk = (critic.chunksHeard === 0)
    ? 0
    : critic.claimsRaised / critic.chunksHeard;

  /**
   * Accepted issues backed per chunk this critic was heard on.
   */
  const hitsPerChunk = (critic.chunksHeard === 0)
    ? 0
    : critic.acceptedHits / critic.chunksHeard;

  return [
    critic.modelId
      .padEnd(COLUMN.model,),
    String(critic.chunksHeard,)
      .padStart(COLUMN.heard,),
    String(critic.claimsRaised,)
      .padStart(COLUMN.raised,),
    String(critic.emissions,)
      .padStart(COLUMN.emitted,),
    String(critic.acceptedHits,)
      .padStart(COLUMN.hits,),
    raisedPerChunk
      .toFixed(RATE_DIGITS,)
      .padStart(COLUMN.raisedPerChunk,),
    hitsPerChunk
      .toFixed(RATE_DIGITS,)
      .padStart(COLUMN.hitsPerChunk,),
  ].join('',);
}

/**
 * Reads a run's artifacts and prints per-critic calibration.
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
   * Report over every settled artifact.
   */
  const report = buildAttributionReport({
    entries: await gatherAttributionEntries({ artifactsDir, },),
  },);

  console.log(
    `POPULATION eligible=${String(report.eligibleEntries,)} `
      + `ineligible=${String(report.ineligibleEntries,)} `
      + `chunks=${String(report.chunks,)}`,
  );
  if (report.eligibleEntries === 0) {
    console.log(
      'NOTE no entry carries attribution yet. Entries settled before it '
        + 'existed record none, and they are excluded rather than counted as '
        + 'critics that raised nothing.',
    );
    return;
  }

  console.log(`\n${headerLine()}`,);
  for (const critic of report.critics)
    console.log(criticLine({ critic, },),);

  console.log(
    `\nSUPPORT sole=${String(report.soleProposerAccepted,)} `
      + `multi=${String(report.multiProposerAccepted,)} `
      + `selfRepeated=${String(report.selfRepeatedAccepted,)} `
      + `unattributed=${String(report.unattributedAccepted,)}`,
  );
  console.log(
    'NOTE sole means an accepted issue rested on exactly one critic, which is '
      + 'legitimate: the reference run had gpt-oss-120b as the sole finder of a '
      + 'planted seed. selfRepeated means one critic emitted the same claim '
      + 'twice, which must never read as agreement. That distinction is what '
      + 'issue 65 asks about duplicates.',
  );
  if (report.unattributedAccepted > 0) {
    console.log(
      `WARNING ${String(report.unattributedAccepted,)} accepted issues on `
        + 'ELIGIBLE entries carry no attribution, meaning a claim id the index '
        + 'does not hold. That is a defect in the join, not a quiet critic.',
    );
  }
}

await main();

//endregion Score attribution
