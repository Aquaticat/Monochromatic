import type { BudgetView, } from '../provider-budget.ts';
import type { RosterModelId, } from '../roster-id.ts';
import type { JudgeSeats, } from './run-seats.ts';
import {
  type BenchName,
  reachableSeats,
} from './run-seats-wait.ts';

//region Writing-bench floor
// THE FIFTEENTH CLASS, the owner's decision of 2026-09-08. The eighth
// hakureico pass ran on Bedrock alone: no editor or refiner had a Bedrock
// seat (`editor round: 0/3 heard` 40 times, `refiner round: 0/3 heard` 52
// times), one translator of seven was reachable, and the pass settled a page
// with five slices that one writer wrote and three judges chose, zero
// repairs and no footnote, as `SETTLED`, told apart from the sixth pass's
// whole-bench page only in its findings. The owner chose that such a pass
// stops INCOMPLETE and leaves the entry for a pass that has the benches
// (`doc/decision/translation-repair-writing-bench-floor.md`).
//
// TWO THRESHOLDS, TWO MEANINGS. A bench short of its quorum under a named
// hold waits (the thirteenth class), and with no hold runs on what is
// reachable and says so. A WRITING bench below its floor with no hold does
// not run: an editor bench of none writes nothing, and a translator bench of
// one writes without a slate, which is the one-writer page. The floor is the
// pair a slate needs, the same number the readers are held to.

/**
 * Benches that write text rather than judge it, which the floor applies to.
 */
export const WRITING_BENCHES: ReadonlySet<BenchName> = new Set<BenchName>([
  'editors',
  'refiners',
  'translators',
],);

/**
 * Reachable seats a writing bench needs to write a slate rather than a single
 * text: a pair, so that a judge has two candidates to choose between.
 */
export const WRITING_BENCH_FLOOR = 2;

/**
 * Stops an entry whose phase cannot write: a writing bench it leans on has
 * fewer reachable seats than the floor and no provider has named its return.
 *
 * @example
 * ```ts
 * throw new WritingBenchUnreachableError({ phase: 'lanes', clauses: ['editors 0 of 3 reachable, floor 2',], },);
 * ```
 */
export class WritingBenchUnreachableError extends Error {
  /**
   * Message carries bench names and counts only, nothing from a provider.
   */
  readonly messageNamesOnly: true = true;

  /**
   * One clause per bench below the floor, as the seats line prints them.
   */
  readonly clauses: readonly string[];

  /**
   * Names the phase that could not write and each bench below the floor.
   *
   * @param phase - phase the reading was taken for
   *
   * @param clauses - one clause per bench below the floor
   */
  public constructor(
    {
      phase,
      clauses,
    }: {
      readonly phase: string;
      readonly clauses: readonly string[];
    },
  ) {
    super(
      `writing bench unreachable at ${phase}: ${clauses.join('; ',)}; `
        + 'no provider has named its return, so the entry stops for a pass that has the bench',
    );
    this.name = 'WritingBenchUnreachableError';
    this.clauses = clauses;
  }
}

/**
 * Every bench the shortfall readings look at, keyed by the name the seats
 * line prints, from one derivation of the seats.
 *
 * @param seats - benches as derived for one reading
 *
 * @returns Bench per name, the writing benches taken from the repair and
 * translate lane rosters
 *
 * @example
 * ```ts
 * const benches = benchesOf({ seats: judgeSeatsFor({ dry, },), },);
 * ```
 */
export function benchesOf(
  { seats, }: { readonly seats: JudgeSeats; },
): Readonly<Record<BenchName, readonly RosterModelId[]>> {
  /**
   * Repair lane writers, whose refiners are optional in the contract.
   */
  const {
    editorModelIds,
    refinerModelIds = [],
  } = seats.repairModels;
  return {
    wide: seats.wideSeats,
    select: seats.selectJudges,
    slate: seats.slateJudges,
    editors: editorModelIds,
    refiners: refinerModelIds,
    translators: seats.translators,
    readers: seats.readers,
  };
}

/**
 * Writing benches among the named ones that cannot reach the floor among the
 * seats a wet provider serves.
 *
 * @param benches - each bench the phase leans on, keyed by name
 *
 * @param names - benches the phase leans on, in the order the line prints them
 *
 * @param dry - dryness per provider, holds folded in
 *
 * @returns One clause per writing bench below the floor, empty when every
 * writing bench can write a slate or the phase leans on none
 *
 * @example
 * ```ts
 * unreachableWritingBenches({ benches, names: phaseBenches({ phase: 'lanes', },), dry, },);
 * // => ['editors 0 of 3 reachable, floor 2', 'refiners 0 of 3 reachable, floor 2',]
 * ```
 */
export function unreachableWritingBenches(
  {
    benches,
    names,
    dry,
  }: {
    readonly benches: Readonly<Record<BenchName, readonly RosterModelId[]>>;
    readonly names: readonly BenchName[];
    readonly dry: BudgetView;
  },
): readonly string[] {
  return names
    .filter(function writes(name,): boolean {
      return WRITING_BENCHES.has(name,);
    },)
    .flatMap(function clauseOf(name,): readonly string[] {
      /**
       * Seats this bench holds.
       */
      const seats = benches[name];
      /**
       * Seats a wet provider would serve.
       */
      const reachable = reachableSeats({
        seats,
        dry,
      },);
      if (reachable.length >= WRITING_BENCH_FLOOR)
        return [];
      return [
        `${name} ${String(reachable.length,)} of ${String(seats.length,)} reachable, floor ${String(WRITING_BENCH_FLOOR,)}`,
      ];
    },);
}

//endregion Writing-bench floor
