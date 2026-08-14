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
   * Settled entries across every group.
   */
  total: number;
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
 * Partitions every settled artifact by the pipeline commit it recorded.
 *
 * @param artifactsDir - directory holding one JSON per settled entry
 *
 * @returns Census grouped by commit, largest group first
 *
 * @example
 * ```ts
 * const census = await censusByTip({ artifactsDir, },);
 * ```
 */
export async function censusByTip(
  { artifactsDir, }: { readonly artifactsDir: string; },
): Promise<GenerationCensus> {
  /**
   * Artifact file names, sorted so the census is reproducible.
   */
  const names = (await readdir(artifactsDir,))
    .filter(function isArtifact(name,): boolean {
      return name.endsWith('.json',);
    },)
    .toSorted();

  /**
   * Entry ids gathered under each recorded commit.
   */
  const byTip = new Map<string, string[]>();

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
     * Settled artifact of this entry.
     */
    const parsed: unknown = JSON.parse(
      await readFile(
        `${artifactsDir}/${name}`,
        'utf8',
      ),
    );

    /**
     * Whether the artifact parsed to something with fields at all.
     */
    const isRecord = ((typeof parsed) === 'object') && (parsed !== null);
    if (!isRecord)
      throw new ArtifactGenerationError({
        entryId,
        reason: 'a JSON object',
      },);

    /**
     * Pipeline commit this run recorded.
     */
    const { tip, } = parsed as { readonly tip?: unknown; };

    /**
     * Whether the recorded commit is usable as a generation key.
     */
    const isUsableTip = ((typeof tip) === 'string') && (tip !== '');
    if (!isUsableTip)
      throw new ArtifactGenerationError({
        entryId,
        reason: 'a non-empty `tip` string',
      },);

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
    total: names.length,
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
