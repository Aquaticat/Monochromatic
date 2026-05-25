import ignore, { type Ignore, } from 'ignore';
import { readFile, } from 'node:fs/promises';
import { join, } from 'node:path';
import type {
  WatchCtx,
  WatchEvent,
  WatchFilter,
} from '../types.ts';

/**
 * Narrows an unknown caught value to {@link NodeJS.ErrnoException}; lets
 * the caller branch on `error.code === 'ENOENT'` without an unsafe
 * `as` assertion (oxlint hard-bans `as NodeJS.ErrnoException`).
 *
 * @param error - caught value (anything; `try` lifts to `unknown`)
 *
 * @returns `true` when `error` is an Error with a `code` property
 *
 * @example
 * ```ts
 * try { await readFile(p,); } catch (error) {
 *   if (isErrnoException(error,) && error.code === 'ENOENT') return undefined;
 *   throw error;
 * }
 * ```
 */
function isErrnoException(error: unknown,): error is NodeJS.ErrnoException {
  return (error instanceof Error) && ('code' in error);
}

/**
 * Reads a file's UTF-8 contents; returns `undefined` if the file does
 * not exist (`ENOENT`). Other errors propagate.
 *
 * Used to soak up "no `.gitignore` here" and "extra-file path was a
 * misconfiguration" in the gitignore-factory hot path without forcing
 * every caller to wrap a `try`. ENOENT is the only error that should
 * collapse to "no patterns"; permission errors, encoding errors, and
 * disk-IO faults still throw.
 *
 * @param path - absolute path to read
 *
 * @returns file contents as a UTF-8 string, or `undefined` on ENOENT
 *
 * @throws Error from `fs.readFile` other than ENOENT
 *
 * @example
 * ```ts
 * const text = await readUtf8IfExists('/abs/.gitignore',);
 * ```
 */
async function readUtf8IfExists(path: string,): Promise<string | undefined> {
  try {
    return await readFile(
      path,
      'utf8',
    );
  }
  catch (error) {
    if (isErrnoException(error,)
      && (error.code
        === 'ENOENT'))
      return undefined;
    throw error;
  }
}

/**
 * Builds a {@link WatchFilter} that rejects events whose `relativePath`
 * matches any rule loaded from a `.gitignore` at each watch root, plus
 * any user-supplied extra gitignore-format files.
 *
 * Async because it reads `.gitignore` files from disk during
 * construction; the orchestrator awaits once before the watcher starts,
 * so the hot path (per-event filter call) stays sync.
 *
 * Each watch root may have a `.gitignore` at its top level; the factory
 * reads all of them in parallel (`Promise.all`) and concatenates their
 * patterns into a single matcher. The same applies to `extraFiles`,
 * which the orchestrator wires from `--ignore-file <path>` (multi). A
 * missing `.gitignore` is silently skipped (ENOENT is the only error
 * collapsed to "no patterns"; other read errors propagate so a
 * permissions or disk-IO problem is not silently masked).
 *
 * Matching trade-off in multi-root setups: all loaded patterns apply to
 * every event globally. With a single watch root (the common case) this
 * is exactly gitignore semantics. With multiple roots, a pattern loaded
 * from root A may match a path under root B if the relativePath happens
 * to collide; the plan documents this as the accepted simplification
 * for the structured-flag CLI, and consumers needing per-root gitignore
 * semantics fall back to the library-API `filter?: WatchFilter`.
 *
 * @returns watch filter that drops gitignored paths; vacuous pass-all when no patterns loaded
 *
 * @throws Error from `fs.readFile` other than ENOENT on any input file
 *
 * @example
 * ```ts
 * const filter = await gitignoreFilter({
 *   roots: ['/abs/repo/src',],
 *   extraFiles: ['/abs/repo/.watchignore',],
 * },);
 * filter({ event: { relativePath: 'dist/build.js', ... }, ctx, },); // false when dist/ is gitignored
 * ```
 */
export async function gitignoreFilter(
  {
    roots,
    extraFiles = [],
  }: {
    readonly roots: readonly string[];
    readonly extraFiles?: readonly string[];
  },
): Promise<WatchFilter> {
  /** Gitignore file paths to attempt: one per root + each explicit extra file. */
  const rootGitignorePaths: readonly string[] = roots.map(
    function toRootGitignore(root,): string {
      return join(
        root,
        '.gitignore',
      );
    },
  );
  /**
   * Parallel read of every candidate file; ENOENT collapses to undefined
   * via {@link readUtf8IfExists}, so a missing `.gitignore` is a no-op
   * rather than a fatal error.
   */
  const allContents: readonly (string | undefined)[] = await Promise.all(
    [
      ...rootGitignorePaths,
      ...extraFiles,
    ]
      .map(function read(path,): Promise<string | undefined> {
        return readUtf8IfExists(path,);
      },),
  );

  /**
   * Single `ignore` instance accumulating every non-undefined file's
   * patterns. The `ignore` package treats `add(content)` as
   * gitignore-format parsing when content is a string with newlines,
   * which matches both `.gitignore` and user-supplied extra files.
   */
  const ig: Ignore = ignore();
  for (const content of allContents) {
    if (content !== undefined)
      ig.add(content,);
  }

  return function gitignoreFilterFn(
    {
      event,
    }: {
      readonly event: WatchEvent;
      readonly ctx: WatchCtx;
    },
  ): boolean {
    return !ig.ignores(event.relativePath,);
  };
}
