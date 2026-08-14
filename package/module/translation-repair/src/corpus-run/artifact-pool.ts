import {
  type EligibleEntries,
  selectEligible,
} from './artifact-eligible.ts';
import { censusByTip, } from './artifact-generation.ts';

//region Artifact pool
// One call for every reader that turns settled artifacts into a NUMBER.
//
// Readers split into two kinds and only one of them belongs here. A scheduler
// asking "which entries already have an artifact" must see all of them, or the
// pass re-runs settled work; `corpus-pass` reads the directory unfiltered for
// exactly that reason and is correct to. A reader producing a rate must see one
// generation, or the rate describes no pipeline that ever existed.
//
// The policy comes from the environment rather than from a flag on each script,
// because these are operational runners invoked by hand and the alternative is
// remembering to pass the same value to four of them.

/**
 * Environment variable naming the commit an eligible pipeline must contain.
 */
const REQUIRED_COMMIT_VAR = 'TRANSLATION_REPAIR_REQUIRED_COMMIT';

/**
 * Environment variable opting into a deliberately mixed pool.
 */
const POOL_ALL_VAR = 'TRANSLATION_REPAIR_POOL_ALL';

/**
 * Value that opts into a mixed pool, spelled out so a stray `0` or empty string
 * cannot silently disable the guard.
 */
const POOL_ALL_VALUE = 'yes';

/**
 * Resolves which settled entries this reader may pool, and prints the census.
 *
 * Printing is not optional and not the caller's choice. A rate over a filtered
 * pool is only readable beside the lines saying what was filtered, and leaving
 * that to each call site is how one of them ends up silently omitting it.
 *
 * @param artifactsDir - directory holding one JSON per settled entry
 *
 * @returns Eligible entries, what was excluded, and the printed report
 *
 * @throws MixedGenerationError when the directory spans pipeline generations
 * and neither `TRANSLATION_REPAIR_REQUIRED_COMMIT` nor
 * `TRANSLATION_REPAIR_POOL_ALL=yes` was set
 *
 * @example
 * ```ts
 * const pool = await resolvePool({ artifactsDir, },);
 * ```
 */
export async function resolvePool(
  {
    artifactsDir,
    names,
  }: {
    readonly artifactsDir: string;
    readonly names?: readonly string[];
  },
): Promise<EligibleEntries> {
  /**
   * Generation policy as the invoker set it.
   */
  const {
    [REQUIRED_COMMIT_VAR]: requiredCommit,
    [POOL_ALL_VAR]: poolAll,
  } = process.env;

  /**
   * Required commit as a plain string, empty when none was set.
   *
   * An exported-but-empty variable is an ordinary shell accident, so it is
   * folded together with absence rather than read as a requirement nobody can
   * satisfy.
   */
  const required = requiredCommit ?? '';

  // Two different pools asked for at once. Preferring either silently records a
  // policy nobody chose, and the report printed above the resulting number
  // would name that policy as though it had been requested.
  if ((required !== '') && (poolAll === POOL_ALL_VALUE))
    throw new Error(
      `${REQUIRED_COMMIT_VAR} and ${POOL_ALL_VAR} are both set, which asks for `
        + 'a filtered pool and an unfiltered one at the same time.\n'
        + 'Unset whichever was not meant. A required commit selects entries '
        + 'whose pipeline contains it; pooling all takes every generation and '
        + 'says so above the number.',
    );

  /**
   * Settled entries partitioned by the commit each recorded.
   *
   * Given the caller's own listing when it has one, so census and reader
   * classify the same files rather than two views of a directory the
   * accumulation is still writing into.
   */
  const census = await censusByTip({
    artifactsDir,
    ...((names === undefined) ? {} : { names, }),
  },);

  /**
   * Entries this reader may pool.
   */
  const eligible = await selectEligible({
    census,
    ...((required === '') ? {} : { requiredCommit: required, }),
    pooledDeliberately: poolAll === POOL_ALL_VALUE,
  },);

  for (const line of eligible.report)
    console.log(line,);

  return eligible;
}

/**
 * Keeps only the artifact file names an eligible entry owns.
 *
 * @param names - artifact file names as read from disk
 *
 * @param eligible - resolved pool
 *
 * @returns Names belonging to eligible entries, order preserved
 *
 * @example
 * ```ts
 * const kept = keepEligible({ names, eligible, },);
 * ```
 */
export function keepEligible(
  {
    names,
    eligible,
  }: {
    readonly names: readonly string[];
    readonly eligible: EligibleEntries;
  },
): readonly string[] {
  /**
   * Ids this reader must still see: everything eligible, plus every artifact
   * that would not parse.
   *
   * Malformed files are carried through rather than filtered because the reader
   * downstream is the one that reports them, and dropping them here would make
   * a corrupt artifact vanish from the failure list instead of appearing on it.
   */
  const allowed = new Set([
    ...eligible.entryIds,
    ...eligible.malformedIds,
  ],);

  return names.filter(function isEligible(name,): boolean {
    return allowed.has(name.slice(
      0,
      -'.json'.length,
    ),);
  },);
}

//endregion Artifact pool
