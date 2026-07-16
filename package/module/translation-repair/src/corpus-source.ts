import { execFile, } from 'node:child_process';
import { promisify, } from 'node:util';

import { resolveGit, } from '@monochromatic-dev/git-policy-cli/ts';
import spawn, { SubprocessError, } from 'nano-spawn';

//region Corpus source
// Reads benchmark texts from the user's local clone of `one-among-us/data`.
// That repository is UNLICENSED (all rights reserved): its content is read at
// runtime for benchmarking and must never be committed into this repository.
// Reads go through `git show <sha>:<path>` against a pinned commit, so benchmark
// runs stay reproducible even while the clone itself moves.

/**
 * Promise adapter for byte-exact subprocess capture;
 * blob reads cannot go through nano-spawn because its line-oriented stdout
 * strips the final newline, and repairs must preserve corpus text
 * byte-for-byte.
 */
// oxlint-disable-next-line typescript/strict-void-return -- promisify deliberately ignores Node execFile's ChildProcess return while adapting its callback
const execFileAsync = promisify(execFile,);

/**
 * Bytes per kibibyte, named for the blob ceiling arithmetic.
 */
const KIBI = 1_024;

/**
 * Mebibytes granted to one blob read;
 * corpus pages are kilobytes, so this bounds runaway reads generously.
 */
const MAX_BLOB_MEBIBYTES = 64;

/**
 * Ceiling for one blob read in bytes.
 */
const MAX_BLOB_BYTES = MAX_BLOB_MEBIBYTES
  * KIBI
  * KIBI;

/**
 * Commit of `one-among-us/data` the milestone-one benchmark pins to.
 * Verified 2026-07-16: HEAD of upstream `main` and of the user's local clone.
 * At this commit `people/` holds 92 zh pages each paired with an en page.
 */
export const CORPUS_COMMIT_SHA = 'a41fc607ea5a70d8a7625cc67d5ed8c444f53379';

/**
 * Location of one pinned corpus checkout:
 * where the clone lives and which commit reads resolve against.
 *
 * @example
 * ```ts
 * const pin: CorpusPin = {
 *   cloneDir: `${homedir()}/one-among-us/data`,
 *   commitSha: CORPUS_COMMIT_SHA,
 * };
 * ```
 */
export type CorpusPin = {
  /**
   * Local clone directory of `one-among-us/data`.
   */
  readonly cloneDir: string;

  /**
   * Commit every read resolves against.
   */
  readonly commitSha: string;

  /**
   * Git binary to run;
   * defaults to resolving the real binary,
   * because the repo PATH exposes a policy shim whose staging guards are not
   * meant for read-only corpus access.
   */
  readonly gitPath?: string;
};

/**
 * Signals a corpus read that git refused:
 * missing clone, unknown commit, or absent path at the pinned commit.
 *
 * @example
 * ```ts
 * throw new CorpusReadError({ detail: 'people/whiskers/page.md at a41fc60', cause: error, },);
 * ```
 */
export class CorpusReadError extends Error {
  /**
   * Builds failure naming what was read and why git refused.
   *
   * @param detail - object spec or listing that failed
   *
   * @param cause - underlying subprocess failure carrying git stderr
   *
   * @mutates cause - `super` may invoke a getter or proxy trap while storing supplied cause
   *
   * @example
   * ```ts
   * new CorpusReadError({ detail: 'people/ at deadbeef', cause: error, },);
   * ```
   */
  public constructor(
    {
      detail,
      cause,
    }: {
      readonly detail: string;
      readonly cause: unknown;
    },
  ) {
    super(
      `corpus read failed for ${detail};`
        + ' check that the clone exists and the pinned commit is present.',
      { cause, },
    );
    this.name = 'CorpusReadError';
  }
}

/**
 * Runs one git command against the clone, returning stdout.
 *
 * @param pin - clone and commit reads resolve against
 *
 * @param args - git argument vector, passed without shell interpretation
 *
 * @param detail - what the read means, for error reporting
 *
 * @returns Captured stdout
 *
 * @throws {@link CorpusReadError} when git exits non-zero
 *
 * @example
 * ```ts
 * const out = await gitOutput({ pin, args: ['show', spec,], detail: spec, },);
 * ```
 */
async function gitOutput(
  {
    pin,
    args,
    detail,
  }: {
    readonly pin: CorpusPin;
    readonly args: readonly string[];
    readonly detail: string;
  },
): Promise<string> {
  /**
   * Real git binary, resolved per call when the pin does not name one;
   * resolution is a handful of PATH probes, negligible next to the spawn.
   */
  const gitPath = pin.gitPath ?? await resolveGit();

  try {
    /**
     * Subprocess result; only stdout is consumed.
     */
    const { stdout, } = await spawn(
      gitPath,
      [
        '-C',
        pin.cloneDir,
        ...args,
      ],
    );
    return stdout;
  }
  catch (error) {
    if (error instanceof SubprocessError) {
      throw new CorpusReadError({
        detail,
        cause: error,
      },);
    }
    throw error;
  }
}

/**
 * Reads one file of the corpus at the pinned commit.
 *
 * @param pin - clone and commit the read resolves against
 *
 * @param relPath - repository-relative path, e.g. `people/<id>/page.md`
 *
 * @returns File content at the pinned commit, byte-for-byte
 *
 * @throws {@link CorpusReadError} when the path is absent at the pinned commit
 *
 * @example
 * ```ts
 * const zh = await readCorpusFile({ pin, relPath: 'people/whiskers/page.md', },);
 * ```
 */
export async function readCorpusFile(
  {
    pin,
    relPath,
  }: {
    readonly pin: CorpusPin;
    readonly relPath: string;
  },
): Promise<string> {
  /**
   * Git object spec pinning path to commit.
   */
  const spec = `${pin.commitSha}:${relPath}`;

  /**
   * Real git binary, resolved when the pin does not name one.
   */
  const gitPath = pin.gitPath ?? await resolveGit();

  try {
    /**
     * Blob bytes captured without any newline normalization.
     */
    const { stdout, } = await execFileAsync(
      gitPath,
      [
        '-C',
        pin.cloneDir,
        'show',
        spec,
      ],
      {
        encoding: 'buffer',
        maxBuffer: MAX_BLOB_BYTES,
      },
    );
    return stdout.toString('utf8',);
  }
  catch (error) {
    throw new CorpusReadError({
      detail: spec,
      cause: error,
    },);
  }
}

/**
 * Lists person entry ids under `people/` at the pinned commit.
 *
 * @param pin - clone and commit the listing resolves against
 *
 * @returns Entry ids in git listing order
 *
 * @throws {@link CorpusReadError} when the clone or commit is unreadable
 *
 * @example
 * ```ts
 * const ids = await listCorpusPeople({ pin, },);
 * ```
 */
export async function listCorpusPeople(
  { pin, }: { readonly pin: CorpusPin; },
): Promise<readonly string[]> {
  /**
   * Newline-separated `people/<id>` lines from git.
   */
  const listing = await gitOutput({
    pin,
    args: [
      'ls-tree',
      '--name-only',
      pin.commitSha,
      'people/',
    ],
    detail: `people/ at ${pin.commitSha}`,
  },);

  return listing
    .split('\n',)
    .filter(function nonEmpty(line,) {
      return line !== '';
    },)
    .map(function stripPrefix(line,) {
      return line.replace(
        'people/',
        '',
      );
    },);
}

//endregion Corpus source
