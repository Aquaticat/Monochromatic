import { access, } from 'node:fs/promises';

import spawn from 'nano-spawn';

import {
  readdirArtifacts,
  readPlacement,
} from './artifact-placement.ts';

//region Artifact generation
// Which PIPELINE VERSION produced each settled artifact, and which ones a draw
// may therefore pool together.
//
// Every artifact records the built output its pass executed, as
// `pipelineDigest`, and the repo commit that pass started under, as `tip`. The
// digest is the identity: it moves exactly when executed bytes move, while the
// tip moves for a documentation commit and stays put across an uncommitted
// edit. The tip is kept because it has ancestry, which a digest cannot have,
// and a draw asking for entries at or after a baseline needs ancestry.
//
// Until this module nothing read either back. Six readers globbed the artifacts
// directory and pooled whatever was there, so a draw silently mixed pipeline
// generations and the resulting rate described no pipeline that ever existed.
//
// That is the same contaminated-denominator failure this milestone has already
// hit twice: once when block count turned out to measure the aligner rather than
// translation coverage, and once when a verification sheet drew only regions
// someone already believed were bad.
//
// NOTHING HERE IS A THRESHOLD. The artifact carries an exact digest and an exact
// commit, and git answers ancestry exactly, so eligibility is computed rather
// than estimated.

/**
 * Real git binary, preferred over the PATH entry.
 *
 * `git` on this repository's PATH resolves to `node_modules/.bin/git`, a shim
 * carrying staging guards. Those guards are irrelevant to read-only calls, but
 * resolving through a shim makes ancestry depend on a wrapper that exists for
 * an unrelated reason, so the real binary is asked for by name.
 */
const SYSTEM_GIT = '/usr/bin/git';

/**
 * One in-flight or settled probe for the git command, keyed by the path
 * probed.
 *
 * A Map rather than a module-root `let`, which the lint rule forbids and
 * which this does not need: the entry is written once. Holding a PROMISE
 * rather than a value keeps resolution on first use rather than on import,
 * so loading this module never touches the filesystem, and concurrent
 * callers share one probe instead of racing several.
 */
const gitProbe = new Map<string, Promise<string>>();

/**
 * Finds a git to spawn, preferring the real binary over the PATH entry.
 *
 * @returns Command name or absolute path
 *
 * @example
 * ```ts
 * const git = await detectGit();
 * ```
 */
async function detectGit(): Promise<string> {
  try {
    await access(SYSTEM_GIT,);
    return SYSTEM_GIT;
  }
  catch (error) {
    // Absent is ordinary anywhere that is not this machine. Logged rather
    // than swallowed, because falling back to PATH means ancestry is
    // answered by whatever git the shell resolves, including a shim, and
    // that is worth seeing in a report which turns on ancestry.
    console.log(
      `POOL ${SYSTEM_GIT} not present (${String(error,)}); using git from PATH`,
    );
    return 'git';
  }
}

/**
 * Git command to spawn, resolved once per process.
 *
 * Not itself async: it hands back the memoised promise, so concurrent
 * callers share one probe rather than racing several.
 *
 * @returns Promise of the command to spawn
 *
 * @example
 * ```ts
 * const git = await resolveGit();
 * ```
 */
function resolveGit(): Promise<string> {
  /**
   * Probe already started for this path, when one has been.
   */
  const started = gitProbe.get(SYSTEM_GIT,);
  if (started !== undefined)
    return started;

  /**
   * Probe this call starts, stored before it settles so a second caller
   * joins it rather than spawning its own.
   */
  const probe = detectGit();
  gitProbe.set(
    SYSTEM_GIT,
    probe,
  );
  return probe;
}

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
 * Settled entries produced by one built pipeline.
 *
 * @example
 * ```ts
 * const group: GenerationGroup = { digest: '53b5a4752...', entryIds: ['Acheron',], };
 * ```
 */
export type GenerationGroup = Readonly<{
  /**
   * Digest of the built output these runs executed, exactly as recorded.
   */
  digest: string;

  /**
   * Entries settled under it, in directory-sorted order.
   */
  entryIds: readonly string[];
}>;

/**
 * Every settled entry, partitioned by the pipeline that produced it.
 *
 * @example
 * ```ts
 * const census = await censusByGeneration({ artifactsDir, },);
 * ```
 */
export type GenerationCensus = Readonly<{
  /**
   * Groups ordered by size, largest first, so a report leads with the bulk.
   */
  groups: readonly GenerationGroup[];

  /**
   * Placed entries across every group.
   */
  total: number;

  /**
   * Repo commit each placed entry recorded, keyed by entry id.
   *
   * Kept per entry rather than per group because one generation can span
   * several commits: a documentation commit moves the tip while the built
   * output stays identical, so those runs are one pipeline recorded under two
   * provenances. Ancestry is therefore asked per commit, never per group.
   */
  tipByEntry: ReadonlyMap<string, string>;

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
   * Entries whose artifact parsed but recorded nothing usable.
   *
   * EXCLUDED from every pool, because this is a real artifact of unknown
   * generation and pooling it is exactly the silent mixing this module exists
   * to stop. Named in the report so the exclusion is visible rather than a
   * quietly smaller denominator.
   */
  untaggedIds: readonly string[];

  /**
   * Entries settled before artifacts recorded which build produced them.
   *
   * Also excluded from every pool, and separate from `untaggedIds` because the
   * remedy differs. These are sound results whose pipeline can no longer be
   * named, so deleting them buys nothing; a directory holding them is finished
   * and the next accumulation belongs in a fresh one.
   */
  preDigestIds: readonly string[];
}>;

/**
 * Partitions every settled artifact by the pipeline that produced it.
 *
 * @param artifactsDir - directory holding one JSON per settled entry
 *
 * @param names - directory listing the CALLER already took, so census and
 * caller classify the same set; omitted only by callers that have not listed
 * the directory themselves
 *
 * @returns Census grouped by built pipeline, largest group first
 *
 * @example
 * ```ts
 * const census = await censusByGeneration({ artifactsDir, names, },);
 * ```
 */
export async function censusByGeneration(
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
  const names = (listed ?? await readdirArtifacts({ artifactsDir, },))
    .filter(function isArtifact(name,): boolean {
      return name.endsWith('.json',);
    },)
    .toSorted();

  /**
   * Entry ids gathered under each recorded build.
   */
  const byDigest = new Map<string, string[]>();

  /**
   * Commit each placed entry recorded, for ancestry.
   */
  const tipByEntry = new Map<string, string>();

  /**
   * Entries whose artifact would not parse.
   */
  const malformedIds: string[] = [];

  /**
   * Entries whose artifact parsed but recorded nothing usable.
   */
  const untaggedIds: string[] = [];

  /**
   * Entries recording a commit but no build.
   */
  const preDigestIds: string[] = [];

  /* oxlint-disable no-await-in-loop -- sequential on purpose: one artifact at a time keeps peak memory flat across a directory that reaches hundreds of megabytes */
  for (const name of names) {
    /**
     * Entry id, which is the artifact's own file name.
     *
     * A file called exactly `.json` has an EMPTY stem, and an empty id in a
     * report is a blank line nobody can act on, so such a file is carried by
     * its name instead. It can only ever appear among the unplaceable, since
     * `readPlacement` refuses an empty stem before reading anything.
     */
    const entryId = (name === '.json')
      ? name
      : name.slice(
        0,
        -'.json'.length,
      );

    /**
     * How this artifact places: its build and commit, or why it has neither.
     */
    const placement = await readPlacement({
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
    if (placement.kind === 'pre-digest') {
      preDigestIds.push(entryId,);
      continue;
    }

    tipByEntry.set(
      entryId,
      placement.tip,
    );
    byDigest.set(
      placement.digest,
      [
        ...(byDigest.get(placement.digest,) ?? []),
        entryId,
      ],
    );
  }
  /* oxlint-enable no-await-in-loop */

  return {
    groups: [
      ...byDigest
        .entries(),
    ]
      .map(function toGroup(
        [digest, entryIds,],
      ): GenerationGroup {
        return {
          digest,
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
    total: tipByEntry.size,
    tipByEntry,
    malformedIds,
    untaggedIds,
    preDigestIds,
  };
}

/**
 * Whether the repository answering ancestry has a truncated history.
 *
 * Asked of the same checkout ancestry is resolved against, since that is the
 * one whose history can be short.
 *
 * @returns Whether this is a shallow clone
 *
 * @example
 * ```ts
 * if (await isShallowRepository()) throw new Error('cannot decide',);
 * ```
 */
async function isShallowRepository(): Promise<boolean> {
  /**
   * Git's own answer, `true` or `false` on one line.
   */
  const { stdout, } = await spawn(
    await resolveGit(),
    [
      '-C',
      HERE,
      'rev-parse',
      '--is-shallow-repository',
    ],
  );
  return stdout.trim() === 'true';
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
      await resolveGit(),
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
    if (isCleanNegative({ error, },)) {
      // Exit 1 means "not an ancestor" only in a COMPLETE history. In a shallow
      // clone the traversal stops at the graft boundary, so a commit that is a
      // real ancestor beyond that boundary reports the same clean negative, and
      // this pool would quietly lose every entry produced before the cut.
      //
      // Asked only here, on the negative path, so the ordinary answer costs no
      // extra process.
      if (await isShallowRepository())
        throw new Error(
          `Cannot decide whether ${tip} contains ${commit}: this is a SHALLOW `
            + 'repository, and `git merge-base --is-ancestor` reports the same '
            + 'exit status for "not an ancestor" and "history stops before the '
            + 'answer".\nA shallow clone therefore cannot separate a stale '
            + 'generation from an old one, and treating the negative as final '
            + 'would drop entries from the pool while every rate above it '
            + 'looked ordinary. Unshallow the repository, or run the reader '
            + 'against a full clone.',
          { cause: error, },
        );
      return false;
    }

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
