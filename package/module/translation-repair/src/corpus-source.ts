import { execFile, } from 'node:child_process';
import { promisify, } from 'node:util';

import { resolveGit, } from '@monochromatic-dev/git-policy-cli/ts/resolve-git.ts';
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
 * What kind of failure a corpus read met.
 *
 * @example
 * ```ts
 * const failure: CorpusReadFailure = 'missing-object';
 * ```
 */
export type CorpusReadFailure =
  /**
   * Git found the commit and the path is not in it, which is what an
   * incomplete pair looks like: `fatal: path 'x' does not exist in 'sha'`.
   */
  | 'missing-object'
  /**
   * Anything else: an unreadable clone, a spawn failure, an oversized blob,
   * a listing that failed.
   */
  | 'other';

/**
 * Stderr phrases with which git reports a path absent at a commit.
 *
 * MEASURED against git 2.55 rather than recalled: a missing path and an
 * unknown commit both say `does not exist in`, and a path present in the
 * working tree but not at the commit says `exists on disk, but not in`.
 */
const MISSING_OBJECT_PHRASES: readonly string[] = [
  'does not exist in',
  'exists on disk, but not in',
];

/**
 * Reads which failure a subprocess error reports.
 *
 * BOTH SUBPROCESS SHAPES ARE READ. Blob reads go through `execFile`, whose
 * promisified rejection carries `stderr` as a buffer; listings go through
 * `nano-spawn`, whose error carries it as a string. Anything without a
 * readable stderr is `other`, since nothing then says the object was missing.
 *
 * @param cause - underlying subprocess failure
 *
 * @returns Failure kind
 *
 * @example
 * ```ts
 * const kind = classifyCorpusReadFailure({ cause: error, },);
 * ```
 */
function classifyCorpusReadFailure({ cause, }: { readonly cause: unknown; },): CorpusReadFailure {
  if ((typeof cause) !== 'object')
    return 'other';
  if (cause === null)
    return 'other';
  if (!('stderr' in cause))
    return 'other';

  /**
   * Whatever stderr the subprocess layer attached, as text.
   */
  const text = stderrText({ stderr: cause.stderr, },);

  /**
   * Whether git said the object is absent at the commit.
   */
  const missing = MISSING_OBJECT_PHRASES.some(function appears(phrase,): boolean {
    return text.includes(phrase,);
  },);
  return missing ? 'missing-object' : 'other';
}

/**
 * Reads a subprocess layer's stderr as text.
 *
 * @param stderr - whatever the layer attached
 *
 * @returns Text, or nothing when it is neither a buffer nor a string
 *
 * @example
 * ```ts
 * const text = stderrText({ stderr: error.stderr, },);
 * ```
 */
function stderrText({ stderr, }: { readonly stderr: unknown; },): string {
  if (Buffer.isBuffer(stderr,))
    return stderr.toString('utf8',);
  if ((typeof stderr) === 'string')
    return stderr;
  return '';
}

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
   * Declares this message safe to forward: it names the corpus path and revision that were asked for, never what they hold.
   */
  readonly messageNamesOnly: true = true;

  /**
   * Which failure git reported, read off its stderr.
   *
   * THE FIELD EVERY CATCHER NEEDED. Until it existed a non-zero git exit, a
   * spawn failure, an unreadable clone and an oversized blob all reached a
   * caller as one class, and every caller read that class as the expected
   * missing side of an incomplete pair: a pass whose clone had gone away
   * dropped every entry in silence and ranked its bands over nothing.
   */
  readonly kind: CorpusReadFailure;

  /**
   * Builds failure naming what was read and why git refused.
   *
   * @param detail - object spec or listing that failed
   *
   * @param cause - underlying subprocess failure carrying git stderr
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
    /**
     * What git's stderr says the failure was.
     */
    const kind = classifyCorpusReadFailure({ cause, },);
    super(
      `corpus read failed for ${detail} (${kind});`
        + ' check that the clone exists and the pinned commit is present.',
      { cause, },
    );
    this.name = 'CorpusReadError';
    this.kind = kind;
  }
}

/**
 * Whether a caught value is a corpus read that failed because the object is
 * not at the pin, which is the one failure a walk over the corpus may step
 * past: an entry with one side is an ordinary state of this corpus.
 *
 * POSITIONAL, since a type predicate cannot narrow a destructured binding.
 *
 * @param error - caught value
 *
 * @returns Whether it is a missing-object corpus read failure
 *
 * @example
 * ```ts
 * if (!isMissingCorpusObject(error,)) throw error;
 * ```
 */
export function isMissingCorpusObject(error: unknown,): error is CorpusReadError {
  return (error instanceof CorpusReadError) && (error.kind === 'missing-object');
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
 * Reads one corpus blob as BYTES at the pinned commit.
 *
 * THE BINARY SIBLING of {@link readCorpusFile}, and the reason it exists is
 * that a picture is not text: decoding one as UTF-8 maps every byte sequence
 * that is not valid UTF-8 onto the replacement character, which silently
 * corrupts the asset and produces a data URI no model can decode.
 *
 * @param pin - corpus clone and commit
 *
 * @param relPath - repository-relative path, e.g. `people/<id>/photos/<name>`
 *
 * @returns Blob bytes exactly as committed
 *
 * @throws {@link CorpusReadError} when git cannot produce that blob
 *
 * @example
 * ```ts
 * const bytes = await readCorpusBytes({ pin, relPath: 'people/whiskers/photos/intro.webp', },);
 * ```
 */
export async function readCorpusBytes(
  {
    pin,
    relPath,
  }: {
    readonly pin: CorpusPin;
    readonly relPath: string;
  },
): Promise<Uint8Array> {
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
     * Blob bytes exactly as committed.
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
    return stdout;
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
