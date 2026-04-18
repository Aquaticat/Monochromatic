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
// oxlint-disable-next-line import/no-cycle -- barrel re-export cycle; dirname is fully initialized before findMonorepoRoot runs
import { dirname, } from './index.ts';

/**
 * Filesystem read function abstraction.
 * Returns file content as a string, or `undefined` when the file does not exist.
 */
type ReadFileFn = (path: string,) => Promise<string | undefined>;

/** Cached filesystem backend, resolved once on first call. */
let cachedReadFile: ReadFileFn | undefined = undefined;

/** Tagged logger for monorepo root discovery diagnostics. */
const l = tagged({ tag: 'findMonorepoRoot', },);

//region Filesystem backend resolution

/**
 * Builds a `ReadFileFn` backed by `node:fs/promises`.
 * Dynamic import keeps `node:fs` out of browser bundles.
 *
 * @returns read function that catches `ENOENT` and returns `undefined`
 */
async function resolveNodeReadFile(): Promise<ReadFileFn> {
  const { readFile, } = await import('node:fs/promises');

  return async function nodeReadFile(path: string,): Promise<string | undefined> {
    try {
      return await readFile(
        path,
        'utf8',
      );
    }
    catch (error: unknown) {
      if (Error.isError(error,) && 'code' in error && error.code === 'ENOENT')
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
  const { readTextFile, } = await import('happy-opfs');
  l.warn(
    'using OPFS for monorepo root discovery -- mise.toml must exist in OPFS to be found',
  );

  return async function opfsReadFile(path: string,): Promise<string | undefined> {
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
  l.warn('no filesystem available for monorepo root discovery -- search will fail',);

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
  if (cachedReadFile !== undefined)
    return cachedReadFile;

  // Node/Bun: process.versions.node is set
  /* oxlint-disable-next-line typescript/no-unnecessary-condition -- runtime guard for browser environments where process is undefined */
  if (typeof process !== 'undefined' && process.versions?.node !== undefined) {
    cachedReadFile = await resolveNodeReadFile();
    return cachedReadFile;
  }

  // Browser: check OPFS support via happy-opfs
  try {
    const { isOPFSSupported, } = await import('happy-opfs');
    if (isOPFSSupported()) {
      cachedReadFile = await resolveOpfsReadFile();
      return cachedReadFile;
    }
  }
  catch {
    /* happy-opfs import failed -- fall through to empty stub */
  }

  // No filesystem available
  cachedReadFile = resolveEmptyReadFile();
  return cachedReadFile;
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
  let dir = cwd;

  // oxlint-disable-next-line no-constant-condition -- terminates when dirname(dir) === dir (filesystem root)
  while (true) {
    // oxlint-disable-next-line eslint/no-await-in-loop -- sequential directory walk requires awaiting each level
    const content = await readFile(`${dir}/mise.toml`,);
    if (content !== undefined && content.includes(MONOREPO_SECTION_MARKER,))
      return dir;

    const parent = dirname(dir,);
    if (parent === dir)
      return undefined;
    dir = parent;
  }
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
 * const root = await findMonorepoRoot();
 * ```
 *
 * @example
 * ```ts
 * const root = await findMonorepoRoot({ cwd: import.meta.dirname });
 * ```
 */
export async function findMonorepoRoot(
  { cwd, }: { cwd?: string; } = {},
): Promise<string> {
  /* oxlint-disable-next-line typescript/no-unnecessary-condition -- process may be undefined in browser */
  const startDir = cwd ?? (typeof process !== 'undefined' ? process.cwd() : '/');
  const readFile = await resolveReadFile();
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

//endregion Public API
