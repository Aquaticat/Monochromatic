/**
 * Monorepo root discovery with cross-runtime filesystem support.
 *
 * Locates the monorepo root by searching upward for a `mise.toml`
 * containing a `[monorepo]` section. Supports three filesystem backends:
 *
 * - **Node/Bun**: `node:fs/promises` via dynamic import
 * - **Browser + OPFS**: `happy-opfs` `readTextFile` when OPFS is available
 * - **Browser - OPFS**: stub that always returns `undefined` (search exhausts, throws)
 *
 * Browser backends log a warning through the tagged logger on first use.
 */

import { tagged, } from '@monochromatic-dev/module-logger/tagged';
// oxlint-disable-next-line import/no-cycle -- barrel re-export cycle; dirname is fully initialized before findMiseMonorepoRoot runs
import { dirname, } from './index.ts';

/**
 * Filesystem read function abstraction.
 * Returns file content as a string, or `undefined` when the file does not exist.
 */
type ReadFileFn = (path: string,) => Promise<string | undefined>;

/**
 * Cached filesystem backend, resolved once on first call.
 * Stored as an object property so module-root state stays in a `const`
 * container (`no-module-root-let` would otherwise reject a top-level `let`).
 */
const backendCache: { readFile?: ReadFileFn; } = {};

/** Tagged logger for monorepo root discovery diagnostics. */
const l = tagged({ tag: 'findMiseMonorepoRoot', },);

//region Filesystem backend resolution

/**
 * Builds a `ReadFileFn` backed by `node:fs/promises`.
 * Dynamic import keeps `node:fs` out of browser bundles.
 *
 * @returns read function that catches `ENOENT` and returns `undefined`
 */
async function resolveNodeReadFile(): Promise<ReadFileFn> {
  /** Dynamic import keeps `node:fs/promises` out of browser bundles. */
  const { readFile, } = await import('node:fs/promises');

  return async function nodeReadFile(path: string,): Promise<string | undefined> {
    try {
      return await readFile(
        path,
        'utf8',
      );
    }
    catch (error: unknown) {
      if (Error.isError(error,) && ('code' in error) && (error.code === 'ENOENT'))
        return undefined;
      throw error;
    }
  };
}

/**
 * Builds a `ReadFileFn` backed by OPFS via `happy-opfs`.
 * Dynamic import keeps `happy-opfs` out of node bundles.
 *
 * @returns read function that unwraps `AsyncIOResult` and returns `undefined` on error
 */
async function resolveOpfsReadFile(): Promise<ReadFileFn> {
  /** Dynamic import keeps `happy-opfs` out of Node bundles where OPFS is unavailable anyway. */
  const { readTextFile, } = await import('happy-opfs');
  l.warn(
    'using OPFS for monorepo root discovery: mise.toml must exist in OPFS to be found',
  );

  return async function opfsReadFile(path: string,): Promise<string | undefined> {
    /** `AsyncIOResult` wrapper from `happy-opfs`; unwrapped only on the success branch so errors map to `undefined`. */
    const result = await readTextFile(path,);
    if (result.isOk())
      return result.unwrap();
    return undefined;
  };
}

/**
 * Returns a stub `ReadFileFn` that always returns `undefined`.
 * Used when no filesystem backend is available (browser without OPFS).
 *
 * @returns stub read function
 */
function resolveEmptyReadFile(): ReadFileFn {
  l.warn('no filesystem available for monorepo root discovery; search will fail',);

  return function emptyReadFile(): Promise<undefined> {
    return Promise.resolve(undefined,);
  };
}

/**
 * Detects the runtime and returns the appropriate `ReadFileFn`.
 * Result is cached after the first call.
 *
 * @returns filesystem read function for the current runtime
 */
async function resolveReadFile(): Promise<ReadFileFn> {
  if (backendCache.readFile !== undefined)
    return backendCache.readFile;

  // Node/Bun: process.versions.node is set
  /* oxlint-disable-next-line typescript/no-unnecessary-condition -- runtime guard for browser environments where process is undefined */
  if (((typeof process) !== 'undefined') && (process.versions?.node !== undefined)) {
    backendCache.readFile = await resolveNodeReadFile();
    return backendCache.readFile;
  }

  // Browser: check OPFS support via happy-opfs
  try {
    /** Dynamic import so the OPFS probe runs only when no Node fs is available. */
    const { isOPFSSupported, } = await import('happy-opfs');
    if (isOPFSSupported()) {
      backendCache.readFile = await resolveOpfsReadFile();
      return backendCache.readFile;
    }
  }
  catch {
    /* happy-opfs import failed; fall through to empty stub */
  }

  // No filesystem available
  backendCache.readFile = resolveEmptyReadFile();
  return backendCache.readFile;
}

//endregion Filesystem backend resolution

//region Walk-up search

/** Marker string that identifies the monorepo root mise.toml. */
const MONOREPO_SECTION_MARKER = '\n[monorepo]\n';

/**
 * Walks up the directory tree from `cwd`, checking each directory
 * for a `mise.toml` containing a `[monorepo]` section.
 *
 * @param cwd - starting directory for upward search
 *
 * @param readFile - filesystem read function
 *
 * @returns absolute path to the directory containing the monorepo `mise.toml`,
 * or `undefined` if not found
 */
async function walkUp({
  cwd,
  readFile,
}: {
  cwd: string;
  readFile: ReadFileFn;
},): Promise<string | undefined> {
  /** `mise.toml` body at the current level, or `undefined` when the file is missing; the marker check decides whether this level is the root. */
  const content = await readFile(`${cwd}/mise.toml`,);
  if ((content !== undefined) && content.includes(MONOREPO_SECTION_MARKER,))
    return cwd;

  /** Next directory to inspect; equal to `cwd` only at the filesystem root, which terminates recursion with `undefined`. */
  const parent = dirname(cwd,);
  if (parent === cwd)
    return undefined;
  return walkUp({
    cwd: parent,
    readFile,
  },);
}

//endregion Walk-up search

//region Public API

/**
 * Finds the monorepo root directory by searching upward from `cwd`
 * for a `mise.toml` containing `[monorepo]`.
 *
 * Normalizes the result to use `/var/home` instead of `/home` on Fedora ostree,
 * where `/home` is a symlink that breaks `readlink -f` resolution.
 *
 * Supports three filesystem backends depending on runtime:
 * - **Node/Bun**: `node:fs/promises` (dynamic import)
 * - **Browser + OPFS**: `happy-opfs` `readTextFile`
 * - **Browser - OPFS**: stub returning `undefined` (search always fails)
 *
 * Browser backends log a warning on first use.
 *
 * @param cwd - starting directory for upward search (defaults to `process.cwd()`)
 *
 * @returns absolute path to the monorepo root
 *
 * @throws when no ancestor directory contains a `mise.toml` with `[monorepo]`
 *
 * @example
 * ```ts
 * const root = await findMiseMonorepoRoot();
 * ```
 *
 * @example
 * ```ts
 * const root = await findMiseMonorepoRoot({ cwd: import.meta.dirname });
 * ```
 */
export async function findMiseMonorepoRoot(
  { cwd, }: { cwd?: string; } = {},
): Promise<string> {
  /* oxlint-disable typescript/no-unnecessary-condition -- process may be undefined in browser */
  /** Walk origin; falls back to `process.cwd()` on Node/Bun and the filesystem root in browsers without a working directory concept. */
  const startDir = cwd ?? (((typeof process) !== 'undefined') ? process.cwd() : '/');
  /* oxlint-enable typescript/no-unnecessary-condition */
  /** Resolved backend captured once so the walk uses a single read function regardless of how many recursion levels run. */
  const readFile = await resolveReadFile();
  /** Walk result before the Fedora ostree `/home` rewrite to `/var/home`; `undefined` means no ancestor matched. */
  const rawRoot = await walkUp({
    cwd: startDir,
    readFile,
  },);

  if (rawRoot === undefined) {
    throw new Error(
      'Could not find monorepo root (no mise.toml with [monorepo] section found upward)',
    );
  }

  /**
   * Normalize `/home/` to `/var/home/` on Fedora ostree.
   * `/home` is a symlink to `/var/home` on ostree systems, and using
   * the symlink path breaks `readlink -f` resolution.
   */
  if (rawRoot.startsWith('/home/',)) {
    return rawRoot.replace(
      '/home/',
      '/var/home/',
    );
  }

  return rawRoot;
}

/**
 * Process-lifetime cache for {@link findMiseMonorepoRootCached}.
 * Stored as an object property so module-root state stays in a `const`
 * container (`no-module-root-let` would otherwise reject a top-level `let`).
 * The in-flight promise reference is reused across concurrent first callers
 * so they share one walk.
 */
const cache: { root?: Promise<string>; } = {};

/**
 * Memoised variant of {@link findMiseMonorepoRoot} that locks in the first
 * resolved root for the lifetime of the process.
 *
 * Result is captured on first call and returned for every subsequent
 * call, even after `process.chdir`. Callers that need a fresh walk after
 * an intentional cwd change use {@link findMiseMonorepoRoot} directly.
 *
 * Rejections are cached too: when the first call cannot find a monorepo
 * root, the same rejection is returned to every later caller. Matches the
 * process-lifetime invariant (no `mise.toml` with `[monorepo]` will
 * materialise mid-process).
 *
 * Internally calls {@link findMiseMonorepoRoot} with no `cwd`, so the first
 * caller's `process.cwd()` at call time decides the result.
 *
 * @returns absolute path to monorepo root, locked in at first call
 *
 * @throws when no ancestor of `process.cwd()` (at first call) contains a
 *   `mise.toml` with `[monorepo]`; same rejection on every later call
 *
 * @example
 * ```ts
 * const root = await findMiseMonorepoRootCached();
 * ```
 *
 * @example
 * ```ts
 * // hot path: thousands of calls share one walk
 * for (const file of files) {
 *   const root = await findMiseMonorepoRootCached();
 *   await spawn('git', ['log', '--', file], { cwd: root, });
 * }
 * ```
 */
export function findMiseMonorepoRootCached(): Promise<string> {
  cache.root ??= findMiseMonorepoRoot();
  return cache.root;
}

//endregion Public API
