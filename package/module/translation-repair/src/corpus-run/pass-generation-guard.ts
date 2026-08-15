import { censusByGeneration, } from './artifact-generation.ts';
import { abbreviate, } from './artifact-provenance.ts';

//region Pass generation guard
// Refuses to RESUME an accumulation into a directory whose settled entries were
// produced by a different build of the pipeline.
//
// A pass identifies its own built output once and stamps that digest on every
// artifact it writes. That is correct for one invocation and says nothing about
// the next, because a pass that stops at its soft budget is resumed by a fresh
// invocation which builds again. If anything changed in between, the resume
// stamps a different pipeline into the same directory, and the pool now spans
// generations.
//
// That is not hypothetical. It is exactly how one accumulation directory came to
// hold 22 entries across FOUR pipelines: not four deliberate decisions, just four
// resumes across an evening of ordinary commits. The readers refuse to compute a
// rate over that pool, so the whole run bought nothing.
//
// The fix belongs here rather than in the readers. By the time a reader refuses,
// the budget is already spent.

/**
 * Environment variable opting into resuming under a different build.
 */
const ALLOW_DRIFT_VAR = 'TRANSLATION_REPAIR_ALLOW_GENERATION_DRIFT';

/**
 * Value that opts in, spelled out so a stray `0` cannot silently disable the
 * guard.
 */
const ALLOW_DRIFT_VALUE = 'yes';

/**
 * Whether this process was started with the drift opt-in.
 *
 * Separated from the guard so the environment is read in exactly one place. The
 * environment is process-wide, so a guard that read it internally could not be
 * exercised by two callers at once, and its own tests had to mutate a shared
 * variable to reach either branch.
 *
 * @returns Whether the variable carries the exact opt-in
 *
 * @example
 * ```ts
 * const driftAllowed = readDriftOptIn();
 * ```
 */
export function readDriftOptIn(): boolean {
  return process.env[ALLOW_DRIFT_VAR] === ALLOW_DRIFT_VALUE;
}

/**
 * Raised when a resume would stamp a second pipeline into one pool.
 */
export class GenerationDriftError extends Error {
  /**
   * Names what is already there, what would be added, and every way forward.
   *
   * @param digests - built pipelines the settled entries already record
   *
   * @param digest - built pipeline this invocation would stamp
   *
   * @example
   * ```ts
   * throw new GenerationDriftError({ digests: ['53b5a4752...',], digest, },);
   * ```
   */
  constructor(
    {
      digests,
      digest,
    }: {
      readonly digests: readonly string[];
      readonly digest: string;
    },
  ) {
    /**
     * Width at which these pipelines stay distinguishable.
     */
    const short = abbreviate({
      ids: [
        ...digests,
        digest,
      ],
    },);

    super(
      [
        'This artifacts directory was built by a different pipeline.',
        '',
        ...digests.map(function toLine(recorded,): string {
          return `  already settled under  ${short({ id: recorded, },)}`;
        },),
        `  this invocation would stamp  ${short({ id: digest, },)}`,
        '',
        'Each of those names the BUILT OUTPUT that ran, so they differ because',
        'the code differs, whatever the commits say. A documentation commit on',
        'its own does not reach here; an uncommitted edit does.',
        '',
        'Resuming would put two pipeline versions in one pool, and every reader',
        'that computes a rate refuses such a pool, so the entries this run',
        'settled would be unusable. Three ways forward:',
        '',
        '  Start a fresh directory, with TRANSLATION_REPAIR_RUNS_DIR. The',
        '  entries already here keep their own generation and stay readable.',
        '',
        '  Restore the code those entries were settled under, and resume',
        '  honestly. The build that runs then matches the digest being stamped.',
        '',
        `  Set ${ALLOW_DRIFT_VAR}=${ALLOW_DRIFT_VALUE} to resume anyway,`,
        '  accepting that this directory will hold several generations and that',
        '  a rate over it must name a required commit.',
      ].join('\n',),
    );
    this.name = 'GenerationDriftError';
  }
}

/**
 * Raised when a directory holds artifacts from before builds were recorded.
 */
export class LegacyPipelineError extends Error {
  /**
   * Names the entries that predate generation identity and what to do.
   *
   * @param entryIds - entries recording a commit but no build
   *
   * @example
   * ```ts
   * throw new LegacyPipelineError({ entryIds: ['Mittens',], },);
   * ```
   */
  constructor({ entryIds, }: { readonly entryIds: readonly string[]; },) {
    super(
      [
        `${String(entryIds.length,)} artifact${
          entryIds.length === 1 ? ' here was' : 's here were'
        } here record a pipeline this build cannot name:`,
        ...entryIds.map(function toLine(entryId,): string {
          return `  ${entryId}`;
        },),
        '',
        'Either they predate generation identity, or they record it in a',
        'scheme this build does not read. Both leave only a commit, which is',
        'provenance rather than identity: one commit covers any number of',
        'builds, so nothing can say whether this invocation is the pipeline',
        'that wrote them.',
        '',
        'Deleting them is NOT the remedy. They are sound results, and a reader',
        'that names their commit can still use them. Point this run at a fresh',
        'directory with TRANSLATION_REPAIR_RUNS_DIR and let this one stand as',
        'the generation it is.',
      ].join('\n',),
    );
    this.name = 'LegacyPipelineError';
  }
}

/**
 * Raised when an artifact records nothing that could identify it.
 */
export class UnplaceableArtifactError extends Error {
  /**
   * Names every unplaceable artifact and what removing it restores.
   *
   * @param entryIds - entries whose artifact carries nothing usable
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
        } in this directory record no readable pipeline:`,
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
        'entry from scratch.',
        '',
        'It is no longer ROUTINE maintenance, and it used to be. Artifacts are',
        'written to a temporary name and renamed once the entry completes, so a',
        'pass killed at its hard cap leaves a .partial rather than half a',
        '.json. Reaching here now means a legacy artifact from before that, a',
        'concurrent writer, a permission fault, or storage trouble.',
      ].join('\n',),
    );
    this.name = 'UnplaceableArtifactError';
  }
}

/**
 * Refuses a resume that would add a second pipeline to one pool.
 *
 * Silent on a fresh directory and on a resume under the same build, which are
 * the two ordinary cases. It reads the settled artifacts rather than trusting a
 * recorded marker, so a directory assembled by hand is judged on what it holds.
 *
 * @param artifactsDir - directory holding one JSON per settled entry
 *
 * @param digest - built pipeline this invocation would stamp on everything it
 * settles
 *
 * @param driftAllowed - whether a mixed directory was asked for, defaulting to
 * this process's opt-in
 *
 * @throws UnplaceableArtifactError when an artifact records nothing usable
 *
 * @throws LegacyPipelineError when artifacts predate generation identity
 *
 * @throws GenerationDriftError when settled entries record any other build and
 * the caller has not opted into drift
 *
 * @example
 * ```ts
 * await assertResumableGeneration({ artifactsDir, digest, },);
 * ```
 */
export async function assertResumableGeneration(
  {
    artifactsDir,
    digest,
    driftAllowed = readDriftOptIn(),
  }: {
    readonly artifactsDir: string;
    readonly digest: string;
    readonly driftAllowed?: boolean;
  },
): Promise<void> {
  // The census runs even when drift is allowed, and the override is applied
  // further down, against the foreign-generation check ALONE. Returning here
  // was a hole: opting into a mixed directory also disarmed the refusals for
  // artifacts that record nothing readable and for artifacts that predate
  // generation identity, which are different problems with different remedies
  // and neither of which drift is an opinion about.
  //
  // Decided BEFORE the census rather than at the point of use, which is what
  // the default parameter buys: the census is an await, so reading the
  // environment afterwards would decide this call by whatever the environment
  // happened to say later.

  /**
   * Pipelines the settled entries already record, and the artifacts none could
   * be read from.
   */
  const {
    groups,
    untaggedIds,
    malformedIds,
    legacyIds,
  } = await censusByGeneration({ artifactsDir, },);

  // An artifact that cannot be placed is WORSE than a foreign generation, and
  // reading only `groups` missed it entirely: a directory holding nothing but
  // unplaceable artifacts produced no groups at all and sailed through.
  //
  // It is worse because the scheduler counts every `.json` name as settled, so
  // such an entry is never retried, and the pool filter excludes it, so it is
  // absent from every rate. The entry silently ceases to exist, and no count
  // anywhere says so. Deleting the file is the whole remedy.
  /**
   * Artifacts carrying nothing usable, whatever the reason.
   */
  const unplaceable = [
    ...untaggedIds,
    ...malformedIds,
  ].toSorted();

  if (unplaceable.length > 0)
    throw new UnplaceableArtifactError({ entryIds: unplaceable, },);

  if (legacyIds.length > 0)
    throw new LegacyPipelineError({ entryIds: legacyIds, },);

  /**
   * Recorded pipelines that are not the one this invocation would stamp.
   */
  const foreign = groups
    .map(function toDigest(group,): string {
      return group.digest;
    },)
    .filter(function isForeign(recorded,): boolean {
      return recorded !== digest;
    },);

  if (foreign.length === 0)
    return;

  if (driftAllowed) {
    console.log(
      `POOL resuming across ${
        String(foreign.length,)
      } foreign pipeline${foreign.length === 1 ? '' : 's'} because ${
        ALLOW_DRIFT_VAR
      }=${ALLOW_DRIFT_VALUE}; a rate over this directory must name a required commit`,
    );
    return;
  }

  throw new GenerationDriftError({
    digests: foreign,
    digest,
  },);
}

//endregion Pass generation guard
