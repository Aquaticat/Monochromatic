import { censusByTip, } from './artifact-generation.ts';

//region Pass generation guard
// Refuses to RESUME an accumulation into a directory whose settled entries were
// produced by a different pipeline commit.
//
// A pass reads HEAD once and stamps it on every artifact it writes. That is
// correct for one invocation and wrong across several, because a pass that stops
// at its soft budget is resumed by a fresh invocation which reads HEAD AGAIN. If
// anything landed in between, the resume stamps a different commit into the same
// directory, and the pool now spans generations.
//
// That is not hypothetical. It is exactly how one accumulation directory came to
// hold 22 entries across FOUR tips: not four deliberate decisions, just four
// resumes across an evening of ordinary commits. The readers refuse to compute a
// rate over that pool, so the whole run bought nothing.
//
// The fix belongs here rather than in the readers. By the time a reader refuses,
// the budget is already spent.

/**
 * Environment variable opting into resuming across a moved HEAD.
 */
const ALLOW_DRIFT_VAR = 'TRANSLATION_REPAIR_ALLOW_TIP_DRIFT';

/**
 * Value that opts in, spelled out so a stray `0` cannot silently disable the
 * guard.
 */
const ALLOW_DRIFT_VALUE = 'yes';

/**
 * Characters of a commit shown in a message.
 */
const SHORT_SHA = 9;

/**
 * Raised when a resume would stamp a second pipeline commit into one pool.
 */
export class TipDriftError extends Error {
  /**
   * Names what is already there, what would be added, and every way forward.
   *
   * @param tips - commits the settled entries already record
   *
   * @param tip - commit this invocation would stamp
   *
   * @example
   * ```ts
   * throw new TipDriftError({ tips: ['a6bbeca50',], tip: 'b1c2d3e4f', },);
   * ```
   */
  constructor(
    {
      tips,
      tip,
    }: {
      readonly tips: readonly string[];
      readonly tip: string;
    },
  ) {
    super(
      [
        'This artifacts directory was built by a different pipeline commit.',
        '',
        ...tips.map(function toLine(recorded,): string {
          return `  already settled under  ${
            recorded.slice(
              0,
              SHORT_SHA,
            )
          }`;
        },),
        `  this invocation would stamp  ${
          tip.slice(
            0,
            SHORT_SHA,
          )
        }`,
        '',
        'Resuming would put two pipeline versions in one pool, and every reader',
        'that computes a rate refuses such a pool, so the entries this run',
        'settled would be unusable. Three ways forward:',
        '',
        '  Start a fresh directory, with TRANSLATION_REPAIR_RUNS_DIR. The',
        '  entries already here keep their own generation and stay readable.',
        '',
        '  Check out the commit they were settled under, and resume honestly.',
        '  The code that runs then matches the commit being stamped.',
        '',
        `  Set ${ALLOW_DRIFT_VAR}=${ALLOW_DRIFT_VALUE} to resume anyway,`,
        '  accepting that this directory will hold several generations and that',
        '  a rate over it must name a required commit.',
      ].join('\n',),
    );
    this.name = 'TipDriftError';
  }
}

/**
 * Raised when an artifact records no pipeline commit that can be read.
 */
export class UnplaceableArtifactError extends Error {
  /**
   * Names every unplaceable artifact and what removing it restores.
   *
   * @param entryIds - entries whose artifact carries no usable commit
   *
   * @example
   * ```ts
   * throw new UnplaceableArtifactError({ entryIds: ['Mittens',], },);
   * ```
   */
  constructor({ entryIds, }: { readonly entryIds: readonly string[]; },) {
    super(
      [
        `${String(entryIds.length,)} artifact${
          entryIds.length === 1 ? '' : 's'
        } in this directory record no readable pipeline commit:`,
        ...entryIds.map(function toLine(entryId,): string {
          return `  ${entryId}`;
        },),
        '',
        'Each one is an entry that has SILENTLY CEASED TO EXIST. The scheduler',
        'counts every .json name as settled, so it will never be retried, and',
        'the pool filter excludes an artifact of unknown generation, so it is',
        'absent from every rate. Nothing else reports the gap.',
        '',
        'Deleting the file is the whole remedy: the next pass re-runs that',
        'entry from scratch. A truncated artifact is the ordinary trace of a',
        'pass killed at its hard cap, so this is expected maintenance rather',
        'than evidence of a defect.',
      ].join('\n',),
    );
    this.name = 'UnplaceableArtifactError';
  }
}

/**
 * Refuses a resume that would add a second pipeline commit to one pool.
 *
 * Silent on a fresh directory and on a resume under the same commit, which are
 * the two ordinary cases. It reads the settled artifacts rather than trusting a
 * recorded marker, so a directory assembled by hand is judged on what it holds.
 *
 * @param artifactsDir - directory holding one JSON per settled entry
 *
 * @param tip - commit this invocation would stamp on everything it settles
 *
 * @throws TipDriftError when settled entries record any other commit and the
 * caller has not opted into drift
 *
 * @example
 * ```ts
 * await assertResumableGeneration({ artifactsDir, tip, },);
 * ```
 */
export async function assertResumableGeneration(
  {
    artifactsDir,
    tip,
  }: {
    readonly artifactsDir: string;
    readonly tip: string;
  },
): Promise<void> {
  if (process.env[ALLOW_DRIFT_VAR] === ALLOW_DRIFT_VALUE)
    return;

  /**
   * Commits the settled entries already record, and the artifacts no commit
   * could be read from.
   */
  const {
    groups,
    untaggedIds,
    malformedIds,
  } = await censusByTip({ artifactsDir, },);

  // An artifact that cannot be placed is WORSE than a foreign tip, and reading
  // only `groups` missed it entirely: a directory holding nothing but
  // unplaceable artifacts produced no groups at all and sailed through.
  //
  // It is worse because the scheduler counts every `.json` name as settled, so
  // such an entry is never retried, and the pool filter excludes it, so it is
  // absent from every rate. The entry silently ceases to exist, and no count
  // anywhere says so. Deleting the file is the whole remedy.
  /**
   * Artifacts carrying no usable pipeline commit, whatever the reason.
   */
  const unplaceable = [
    ...untaggedIds,
    ...malformedIds,
  ].toSorted();

  if (unplaceable.length > 0)
    throw new UnplaceableArtifactError({ entryIds: unplaceable, },);

  /**
   * Recorded commits that are not the one this invocation would stamp.
   */
  const foreign = groups
    .map(function toTip(group,): string {
      return group.tip;
    },)
    .filter(function isForeign(recorded,): boolean {
      return recorded !== tip;
    },);

  if (foreign.length === 0)
    return;

  throw new TipDriftError({
    tips: foreign,
    tip,
  },);
}

//endregion Pass generation guard
