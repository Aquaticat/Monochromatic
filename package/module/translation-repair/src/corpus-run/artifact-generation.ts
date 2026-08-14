import {
  readdir,
  readFile,
} from 'node:fs/promises';

import spawn from 'nano-spawn';

//region Artifact generation
// Which PIPELINE VERSION produced each settled artifact, and which ones a draw
// may therefore pool together.
//
// Every artifact already records the repo commit its run started under, as
// `tip`, written by `corpus-pass`. Until this module nothing read it back. Six
// readers globbed the artifacts directory and pooled whatever was there, so a
// draw silently mixed pipeline generations and the resulting rate described no
// pipeline that ever existed.
//
// That is the same contaminated-denominator failure this milestone has already
// hit twice: once when block count turned out to measure the aligner rather than
// translation coverage, and once when a verification sheet drew only regions
// someone already believed were bad.
//
// NOTHING HERE IS A THRESHOLD. The artifact carries an exact commit and git
// answers ancestry exactly, so eligibility is computed rather than estimated.

/**
 * Real git binary; the repo PATH shim's staging guards are irrelevant to
 * read-only calls.
 */
const GIT_BINARY = '/usr/bin/git';

/**
 * Directory of this source file, for locating the worktree via git.
 */
const HERE = import.meta.dirname;

/**
 * Exit status `git merge-base --is-ancestor` uses for a clean negative.
 *
 * Anything else is a real failure: an unknown commit exits 128, and treating
 * that as "not eligible" would quietly shrink the denominator.
 */
const NOT_ANCESTOR_EXIT = 1;

/**
 * Settled entries sharing one pipeline commit.
 *
 * @example
 * ```ts
 * const group: TipGroup = { tip: 'a6bbeca50...', entryIds: ['Acheron',], };
 * ```
 */
export type TipGroup = Readonly<{
  /**
   * Repo commit the run recorded, exactly as written.
   */
  tip: string;

  /**
   * Entries settled under it, in directory-sorted order.
   */
  entryIds: readonly string[];
}>;

/**
 * Every settled entry, partitioned by the pipeline commit that produced it.
 *
 * @example
 * ```ts
 * const census = await censusByTip({ artifactsDir, },);
 * ```
 */
export type GenerationCensus = Readonly<{
  /**
   * Groups ordered by size, largest first, so a report leads with the bulk.
   */
  groups: readonly TipGroup[];

  /**
   * Placed entries across every group.
   */
  total: number;

  /**
   * Entries whose artifact would not parse at all.
   *
   * KEPT IN THE POOL DELIBERATELY, and separate from `untaggedIds` for that
   * reason. A pass killed at its hard cap can leave one truncated artifact, and
   * this package already decided such a file costs its own row and not the
   * whole run. Filtering it out here would not protect anything: it would take
   * the file away from the reader whose job is to report it as malformed, so a
   * corrupt artifact would vanish from the failure list instead of appearing on
   * it. Generation filtering answers a generation question; a file that is not
   * JSON has not reached that question yet.
   */
  malformedIds: readonly string[];

  /**
   * Entries whose artifact parsed but recorded no usable commit.
   *
   * EXCLUDED from every pool, because this is a real artifact of unknown
   * generation and pooling it is exactly the silent mixing this module exists
   * to stop. Named in the report so the exclusion is visible rather than a
   * quietly smaller denominator.
   */
  untaggedIds: readonly string[];
}>;

/**
 * Raised when an artifact carries no usable pipeline commit.
 */
export class ArtifactGenerationError extends Error {
  /**
   * Names the artifact and what was wrong with its recorded commit.
   *
   * @param entryId - entry whose artifact is at fault
   *
   * @param reason - what the commit field should have been
   *
   * @example
   * ```ts
   * throw new ArtifactGenerationError({ entryId: 'Acheron', reason: 'a string', },);
   * ```
   */
  constructor(
    {
      entryId,
      reason,
    }: {
      readonly entryId: string;
      readonly reason: string;
    },
  ) {
    super(
      `Artifact ${entryId} records no usable pipeline commit: expected ${reason}.\n`
        + 'Every artifact must carry `tip`, the repo commit its run started '
        + 'under, because that is the only thing that says which pipeline '
        + 'produced it. An artifact without one cannot be placed in any '
        + 'generation, so pooling it would mix versions silently, which is the '
        + 'exact failure this check exists to prevent.',
    );
    this.name = 'ArtifactGenerationError';
  }
}

/**
 * How one artifact places into a generation.
 */
type Placement =
  | Readonly<{
    kind: 'tagged';
    tip: string;
  }>
  | Readonly<{ kind: 'malformed'; }>
  | Readonly<{ kind: 'untagged'; }>;

/**
 * Reads one artifact's recorded pipeline commit.
 *
 * Reports rather than throws, because this package already decided a corrupt
 * artifact costs its own row and not the whole run. The two failure kinds stay
 * distinct because they are handled oppositely: a malformed file belongs to the
 * reader that reports malformed files, and an untagged one belongs nowhere.
 *
 * @param artifactsDir - directory holding the artifact
 *
 * @param name - artifact file name
 *
 * @returns How this artifact places
 *
 * @example
 * ```ts
 * const placement = await readTip({ artifactsDir, name: 'Acheron.json', },);
 * ```
 */
async function readTip(
  {
    artifactsDir,
    name,
  }: {
    readonly artifactsDir: string;
    readonly name: string;
  },
): Promise<Placement> {
  /**
   * Raw artifact text.
   */
  const text = await readFile(
    `${artifactsDir}/${name}`,
    'utf8',
  );

  try {
    /**
     * Artifact as parsed JSON.
     */
    const parsed: unknown = JSON.parse(text,);

    if (((typeof parsed) !== 'object') || (parsed === null))
      return { kind: 'untagged', };
    if (!('tip' in parsed))
      return { kind: 'untagged', };

    /**
     * Commit as the artifact recorded it.
     */
    const { tip, } = parsed;

    if (((typeof tip) !== 'string') || (tip === ''))
      return { kind: 'untagged', };

    return {
      kind: 'tagged',
      tip,
    };
  }
  catch (error) {
    // A truncated artifact is an ordinary outcome of a pass killed at its hard
    // cap. Logged rather than swallowed so a systematic write fault is visible
    // instead of showing up as a quietly smaller pool.
    console.log(
      `POOL malformed ${name}: ${String(error,)}`,
    );
    return { kind: 'malformed', };
  }
}

/**
 * Partitions every settled artifact by the pipeline commit it recorded.
 *
 * @param artifactsDir - directory holding one JSON per settled entry
 *
 * @param names - directory listing the CALLER already took, so census and
 * caller classify the same set; omitted only by callers that have not listed
 * the directory themselves
 *
 * @returns Census grouped by commit, largest group first
 *
 * @example
 * ```ts
 * const census = await censusByTip({ artifactsDir, names, },);
 * ```
 */
export async function censusByTip(
  {
    artifactsDir,
    names: listed,
  }: {
    readonly artifactsDir: string;
    readonly names?: readonly string[];
  },
): Promise<GenerationCensus> {
  /**
   * Artifact file names, sorted so the census is reproducible.
   *
   * Accepting the caller's listing matters more than saving one read. A reader
   * that lists the directory, censuses it separately, then loads each file is
   * taking THREE views of a directory the accumulation is still writing into,
   * and an artifact arriving between the first two joins the census while never
   * entering the candidate pool. One listing threaded through closes the gap
   * between the two views this module controls.
   */
  const names = (listed ?? await readdir(artifactsDir,))
    .filter(function isArtifact(name,): boolean {
      return name.endsWith('.json',);
    },)
    .toSorted();

  /**
   * Entry ids gathered under each recorded commit.
   */
  const byTip = new Map<string, string[]>();

  /**
   * Entries whose artifact would not parse.
   */
  const malformedIds: string[] = [];

  /**
   * Entries whose artifact parsed but recorded no usable commit.
   */
  const untaggedIds: string[] = [];

  /* oxlint-disable no-await-in-loop -- sequential on purpose: one artifact at a time keeps peak memory flat across a directory that reaches hundreds of megabytes */
  for (const name of names) {
    /**
     * Entry id, which is the artifact's own file name.
     */
    const entryId = name.slice(
      0,
      -'.json'.length,
    );

    /**
     * How this artifact places: its commit, or why it has none.
     */
    const placement = await readTip({
      artifactsDir,
      name,
    },);

    if (placement.kind === 'malformed') {
      malformedIds.push(entryId,);
      continue;
    }
    if (placement.kind === 'untagged') {
      untaggedIds.push(entryId,);
      continue;
    }

    /**
     * Commit this artifact recorded.
     */
    const { tip, } = placement;

    byTip.set(
      tip,
      [
        ...(byTip.get(tip,) ?? []),
        entryId,
      ],
    );
  }
  /* oxlint-enable no-await-in-loop */

  return {
    groups: [
      ...byTip
        .entries(),
    ]
      .map(function toGroup(
        [tip, entryIds,],
      ): TipGroup {
        return {
          tip,
          entryIds,
        };
      },)
      .toSorted(function largestFirst(
        left,
        right,
      ): number {
        /**
         * How many entries the left generation holds.
         */
        const leftSize = left.entryIds
          .length;

        /**
         * How many entries the right generation holds.
         */
        const rightSize = right.entryIds
          .length;

        return rightSize - leftSize;
      },),
    total: names.length
      - malformedIds
        .length
      - untaggedIds
        .length,
    malformedIds,
    untaggedIds,
  };
}

/**
 * Whether a failed git call was a clean "not an ancestor" answer.
 *
 * Asked as a boolean rather than by returning the status, because the only
 * status this module can act on is the one negative git defines. Every other
 * exit, and every failure carrying no exit at all, has to reach the caller as a
 * fault rather than as a quiet false.
 *
 * @param error - value a failed spawn threw
 *
 * @returns Whether git exited with its documented negative
 *
 * @example
 * ```ts
 * const answered = isCleanNegative({ error, },);
 * ```
 */
function isCleanNegative({ error, }: { readonly error: unknown; },): boolean {
  if (((typeof error) !== 'object') || (error === null))
    return false;
  if (!('exitCode' in error))
    return false;

  /**
   * Status as the subprocess error carries it.
   */
  const { exitCode, } = error;

  return exitCode === NOT_ANCESTOR_EXIT;
}

/**
 * Whether one pipeline commit contains another.
 *
 * @param tip - commit an artifact recorded
 *
 * @param commit - commit the draw requires
 *
 * @returns Whether `commit` is an ancestor of `tip`, or the same commit
 *
 * @throws When either commit is unknown to this repository, since a pool that
 * cannot be partitioned must not be silently narrowed
 *
 * @example
 * ```ts
 * const eligible = await tipContains({ tip, commit: 'fc7912929', },);
 * ```
 */
export async function tipContains(
  {
    tip,
    commit,
  }: {
    readonly tip: string;
    readonly commit: string;
  },
): Promise<boolean> {
  try {
    await spawn(
      GIT_BINARY,
      [
        '-C',
        HERE,
        'merge-base',
        '--is-ancestor',
        commit,
        tip,
      ],
    );
    return true;
  }
  catch (error) {
    if (isCleanNegative({ error, },))
      return false;

    throw new Error(
      `Cannot place pipeline commit ${tip} against required commit ${commit}.\n`
        + 'This is NOT treated as "not eligible". An unresolvable commit means '
        + 'the pool cannot be partitioned at all, and quietly excluding it '
        + 'would shrink the denominator while every rate above it looked '
        + 'ordinary. Fetch the commit, or name a required commit this '
        + 'repository knows.',
      { cause: error, },
    );
  }
}

//endregion Artifact generation
