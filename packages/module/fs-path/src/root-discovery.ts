/**
 * Shared upward-walk root discovery helpers.
 *
 * Root finders in this package use these helpers to keep filesystem probing
 * local and cross-runtime.
 *
 * @module
 */

import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import {
  dirnameFallback,
  resolveFallback,
} from './fallbacks.ts';

//region Types

/**
 * Filesystem operations needed by upward root discovery.
 */
export type RootFilesystem = {
  /**
   * Reads UTF-8 text, returning {@link ABSENT} when path is absent.
   */
  readonly readTextFile: (path: string,) => Promise<string | typeof ABSENT>;

  /**
   * Reads symbolic-link target text,
   * returning {@link ABSENT} when path is absent or not a symbolic link.
   */
  readonly readSymbolicLink: (path: string,) => Promise<string | typeof ABSENT>;

  /**
   * Checks whether path exists as any filesystem entry kind.
   */
  readonly exists: (path: string,) => Promise<boolean>;

  /**
   * Checks whether path resolves to a directory.
   */
  readonly isDirectory: (path: string,) => Promise<boolean>;

  /**
   * Checks whether path resolves to a regular file.
   */
  readonly isFile: (path: string,) => Promise<boolean>;

  /**
   * Resolves path against a containing directory with runtime-native semantics.
   */
  readonly resolvePath: (options: {
    readonly from: string;
    readonly path: string;
  },) => string;
};

/**
 * Arguments supplied to a candidate-root matcher.
 */
export type RootMatcherArgs = {
  /**
   * Directory currently being tested as root candidate.
   */
  readonly dir: string;

  /**
   * Filesystem backend resolved for current runtime.
   */
  readonly fs: RootFilesystem;
};

/**
 * Predicate that decides whether a directory is a root.
 */
export type RootMatcher = (args: RootMatcherArgs,) => Promise<boolean>;

/**
 * Options for {@link findRootByWalkingUp}.
 */
export type FindRootByWalkingUpOptions = {
  /**
   * Starting directory. Defaults to current process working directory.
   */
  readonly cwd?: string;

  /**
   * Candidate-root predicate applied at each ancestor.
   */
  readonly matches: RootMatcher;

  /**
   * Error message used when no ancestor matches.
   */
  readonly missingMessage: string;
};

/**
 * Options for the internal upward walk.
 */
type WalkUpRootOptions = {
  /**
   * Directory currently being tested.
   */
  readonly dir: string;

  /**
   * Filesystem backend shared by every recursion level.
   */
  readonly fs: RootFilesystem;

  /**
   * Candidate-root predicate applied at each ancestor.
   */
  readonly matches: RootMatcher;

  /**
   * Error message thrown when the filesystem root is reached without a match.
   */
  readonly missingMessage: string;
};

/**
 * Cache shape for the lazily resolved filesystem backend.
 */
type RootFilesystemCache = {
  /**
   * Filesystem backend promise result reused after first resolution.
   */
  fs?: RootFilesystem;
};

//endregion Types

//region Constants

/**
 * Sentinel returned by {@link RootFilesystem.readTextFile} when a path is absent.
 * A unique `Symbol` distinguishes "file missing" from empty content without a
 * nullish union; matchers narrow with `content !== ABSENT` before inspecting it.
 */
export const ABSENT: unique symbol = Symbol('root discovery path content absent on filesystem',);

/**
 * Tagged logger for root discovery diagnostics.
 */
const rootDiscoveryLogger = tagged({ tag: 'rootDiscovery', },);

/**
 * Filesystem backend cache, stored in a const container for module-root state.
 */
const backendCache: RootFilesystemCache = {};

/**
 * Error codes that mean a candidate path is absent for discovery purposes.
 */
const NO_ENTRY_ERROR_CODES: ReadonlySet<string> = new Set([
  'ENOENT',
  'ENOTDIR',
],);

//endregion Constants

//region Runtime filesystem backend

/**
 * Checks whether an error represents an absent candidate path.
 *
 * @param error - thrown value from filesystem operation
 *
 * @returns `true` when discovery should continue upward
 *
 * @example
 * ```ts
 * if (isNoEntryError(error)) return ABSENT;
 * ```
 */
function isNoEntryError(error: unknown,): boolean {
  if (!Error.isError(error,))
    return false;
  if (!('code' in error))
    return false;
  if ((typeof error.code) !== 'string')
    return false;
  return NO_ENTRY_ERROR_CODES.has(error.code,);
}

/**
 * Builds a root-discovery filesystem backed by `node:fs/promises`.
 *
 * Dynamic import keeps `node:fs` out of browser bundles.
 *
 * @returns filesystem backend for Node and Bun
 *
 * @example
 * ```ts
 * const fs = await resolveNodeRootFilesystem();
 * ```
 */
async function resolveNodeRootFilesystem(): Promise<RootFilesystem> {
  /**
   * Dynamic import keeps `node:fs/promises` out of browser bundles.
   */
  const [
    {
      lstat,
      readFile,
      readlink,
      stat,
    },
    {
      resolve,
    },
  ] = await Promise.all([
    import('node:fs/promises'),
    import('node:path'),
  ],);

  return {
    readTextFile: async function nodeReadTextFile(
      path: string,
    ): Promise<string | typeof ABSENT> {
      try {
        return await readFile(
          path,
          'utf8',
        );
      }
      catch (error: unknown) {
        if (isNoEntryError(error,))
          return ABSENT;
        throw error;
      }
    },

    readSymbolicLink: async function nodeReadSymbolicLink(
      path: string,
    ): Promise<string | typeof ABSENT> {
      try {
        if (!(await lstat(path,)).isSymbolicLink())
          return ABSENT;
        return await readlink(path,);
      }
      catch (error: unknown) {
        if (isNoEntryError(error,))
          return ABSENT;
        throw error;
      }
    },

    exists: async function nodeExists(path: string,): Promise<boolean> {
      try {
        await lstat(path,);
        return true;
      }
      catch (error: unknown) {
        if (isNoEntryError(error,))
          return false;
        throw error;
      }
    },

    isDirectory: async function nodeIsDirectory(path: string,): Promise<boolean> {
      try {
        return (await stat(path,)).isDirectory();
      }
      catch (error: unknown) {
        if (isNoEntryError(error,))
          return false;
        throw error;
      }
    },

    isFile: async function nodeIsFile(path: string,): Promise<boolean> {
      try {
        return (await stat(path,)).isFile();
      }
      catch (error: unknown) {
        if (isNoEntryError(error,))
          return false;
        throw error;
      }
    },

    resolvePath: function nodeResolvePath({
      from,
      path,
    }: {
      readonly from: string;
      readonly path: string;
    },): string {
      return resolve(
        from,
        path,
      );
    },
  };
}

/**
 * Returns absence for runtimes without symbolic links.
 *
 * @param _path - ignored symbolic-link path
 *
 * @returns promise resolving to {@link ABSENT}
 *
 * @example
 * ```ts
 * await unsupportedReadSymbolicLink('/repo/.git/HEAD');
 * ```
 */
function unsupportedReadSymbolicLink(_path: string,): Promise<typeof ABSENT> {
  return Promise.resolve(ABSENT,);
}

/**
 * Resolves path with portable fallback semantics.
 *
 * @param from - containing directory
 *
 * @param path - candidate path
 *
 * @returns normalized resolved path
 *
 * @example
 * ```ts
 * resolveFallbackPath({ from: '/repo', path: '.git' });
 * ```
 */
function resolveFallbackPath({
  from,
  path,
}: {
  readonly from: string;
  readonly path: string;
},): string {
  return resolveFallback([
    from,
    path,
  ],);
}

/**
 * Builds a root-discovery filesystem backed by OPFS through `happy-opfs`.
 *
 * @returns filesystem backend for browsers with OPFS support
 *
 * @example
 * ```ts
 * const fs = await resolveOpfsRootFilesystem();
 * ```
 */
async function resolveOpfsRootFilesystem(): Promise<RootFilesystem> {
  /**
   * Dynamic import keeps `happy-opfs` out of Node bundles where OPFS is unavailable.
   */
  const {
    exists: opfsExists,
    readTextFile,
  } = await import('happy-opfs');
  rootDiscoveryLogger.warn(
    'using OPFS for root discovery: marker files must exist in OPFS to be found',
  );

  return {
    readTextFile: async function opfsReadTextFile(
      path: string,
    ): Promise<string | typeof ABSENT> {
      /**
       * {@link AsyncIOResult} from `happy-opfs`; errors map to absent files.
       */
      const result = await readTextFile(path,);
      if (result.isOk())
        return result.unwrap();
      return ABSENT;
    },

    readSymbolicLink: unsupportedReadSymbolicLink,

    exists: async function opfsPathExists(path: string,): Promise<boolean> {
      /**
       * {@link AsyncIOResult} from `happy-opfs`; errors map to absent marker paths.
       */
      const result = await opfsExists(path,);
      if (result.isOk())
        return result.unwrap();
      return false;
    },

    isDirectory: async function opfsPathIsDirectory(path: string,): Promise<boolean> {
      /**
       * {@link AsyncIOResult} from `happy-opfs`; errors map to non-directories.
       */
      const result = await opfsExists(
        path,
        { isDirectory: true, },
      );
      if (result.isOk())
        return result.unwrap();
      return false;
    },

    isFile: async function opfsPathIsFile(path: string,): Promise<boolean> {
      /**
       * {@link AsyncIOResult} from `happy-opfs`; errors map to non-files.
       */
      const result = await opfsExists(
        path,
        { isFile: true, },
      );
      if (result.isOk())
        return result.unwrap();
      return false;
    },

    resolvePath: resolveFallbackPath,
  };
}

/**
 * Empty text reader used when no filesystem backend exists.
 *
 * @param _path - ignored candidate path
 *
 * @returns promise resolving to {@link ABSENT}
 *
 * @example
 * ```ts
 * await emptyReadTextFile('/repo/mise.toml');
 * ```
 */
function emptyReadTextFile(_path: string,): Promise<typeof ABSENT> {
  return Promise.resolve(ABSENT,);
}

/**
 * Empty existence probe used when no filesystem backend exists.
 *
 * @param _path - ignored candidate path
 *
 * @returns promise resolving to `false`
 *
 * @example
 * ```ts
 * await emptyExists('/repo/.git');
 * ```
 */
function emptyExists(_path: string,): Promise<boolean> {
  return Promise.resolve(false,);
}

/**
 * Builds a root-discovery filesystem that never finds marker files.
 *
 * Used when no filesystem backend is available.
 *
 * @returns empty filesystem backend for browsers without OPFS
 *
 * @example
 * ```ts
 * const fs = resolveEmptyRootFilesystem();
 * ```
 */
function resolveEmptyRootFilesystem(): RootFilesystem {
  rootDiscoveryLogger.warn('no filesystem available for root discovery; search will fail',);

  return {
    readTextFile: emptyReadTextFile,

    readSymbolicLink: unsupportedReadSymbolicLink,

    exists: emptyExists,

    isDirectory: emptyExists,

    isFile: emptyExists,

    resolvePath: resolveFallbackPath,
  };
}

/**
 * Resolves filesystem backend for current runtime.
 *
 * Result is cached after first call so every root finder shares one backend.
 *
 * @returns filesystem backend for current runtime
 *
 * @example
 * ```ts
 * const fs = await resolveRootFilesystem();
 * ```
 */
export async function resolveRootFilesystem(): Promise<RootFilesystem> {
  if (backendCache.fs
    !== undefined)
    return backendCache.fs;

  // Node/Bun: process.versions.node is set.
  if (((typeof process) !== 'undefined') && (process.versions
    ?.node
    !== undefined)) {
    backendCache.fs = await resolveNodeRootFilesystem();
    return backendCache.fs;
  }

  try {
    /**
     * Dynamic import so the OPFS probe runs only when no Node fs is available.
     */
    const { isOPFSSupported, } = await import('happy-opfs');
    if (isOPFSSupported()) {
      backendCache.fs = await resolveOpfsRootFilesystem();
      return backendCache.fs;
    }
  }
  catch (error: unknown) {
    rootDiscoveryLogger.debug(`happy-opfs import failed during root discovery setup: ${caughtValueText(error,)}`,);
  }

  backendCache.fs = resolveEmptyRootFilesystem();
  return backendCache.fs;
}

//endregion Runtime filesystem backend

//region Path helpers

/**
 * Returns default root-search start directory for current runtime.
 *
 * @returns process working directory in Node and Bun, otherwise filesystem root
 *
 * @example
 * ```ts
 * const cwd = defaultRootSearchCwd();
 * ```
 */
export function defaultRootSearchCwd(): string {
  if (((typeof process) !== 'undefined') && ((typeof process.cwd) === 'function'))
    return process.cwd();
  return '/';
}

//endregion Path helpers

//region Upward walk

/**
 * Walks upward from a candidate directory until matcher succeeds.
 *
 * @param dir - candidate directory tested first
 *
 * @param fs - filesystem backend used for all probes
 *
 * @param matches - predicate that identifies root directory
 *
 * @param missingMessage - error text thrown when no ancestor matches
 *
 * @returns matching root directory
 *
 * @throws when the filesystem root is reached without a match
 *
 * @example
 * ```ts
 * const root = await walkUpRoot({ dir: '/repo/src', fs, matches, missingMessage });
 * ```
 */
async function walkUpRoot({
  dir,
  fs,
  matches,
  missingMessage,
}: WalkUpRootOptions,): Promise<string> {
  if (await matches({
    dir,
    fs,
  },))
    return dir;

  /**
   * Parent directory inspected after current candidate misses.
   */
  const parent = dirnameFallback(dir,);
  if (parent === dir)
    throw new Error(missingMessage,);

  return walkUpRoot({
    dir: parent,
    fs,
    matches,
    missingMessage,
  },);
}

/**
 * Finds a root by walking upward from `cwd` and applying `matches`.
 *
 * @param cwd - starting directory, defaults to current process working directory
 *
 * @param matches - candidate-root predicate
 *
 * @param missingMessage - error text when no ancestor matches
 *
 * @returns matching root directory
 *
 * @throws when no ancestor satisfies `matches`
 *
 * @example
 * ```ts
 * const root = await findRootByWalkingUp({
 *   matches: async ({ dir, fs }) => await fs.exists(`${dir}/.git`),
 *   missingMessage: 'missing git root',
 * });
 * ```
 */
export async function findRootByWalkingUp({
  cwd,
  matches,
  missingMessage,
}: FindRootByWalkingUpOptions,): Promise<string> {
  /**
   * Directory where upward search starts.
   */
  const startDir = cwd ?? defaultRootSearchCwd();
  rootDiscoveryLogger.debug(`starting root discovery from ${startDir}`,);

  /**
   * Filesystem backend resolved once per walk.
   */
  const fs = await resolveRootFilesystem();
  /**
   * Matching root using caller's runtime-native path identity.
   */
  const root = await walkUpRoot({
    dir: startDir,
    fs,
    matches,
    missingMessage,
  },);
  rootDiscoveryLogger.debug(`resolved root discovery result ${root}`,);
  return root;
}

//endregion Upward walk
