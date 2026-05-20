import { createRequire, } from 'node:module';
import { join, } from 'node:path';

import {
  findMiseMonorepoRootCached,
} from '@monochromatic-dev/module-fs-path/find-monorepo-root';
import {
  l,
  tagged,
} from './log.ts';

/**
 * Attempts to resolve a bare specifier from a given base directory.
 * Returns the resolved path or `undefined` if resolution fails.
 *
 * @param specifier - ESM import specifier (e.g. `lodash`, `@scope/pkg/sub`)
 *
 * @param baseDir - Directory to resolve from
 *
 * @returns Resolved file URL string, or `undefined` on failure
 *
 * @example
 * ```ts
 * resolveFrom('lodash', '/home/user/project');
 * // => 'file:///home/user/project/node_modules/lodash/index.js'
 * ```
 */
function resolveFrom(
  {
    specifier,
    baseDir,
  }: {
    specifier: string;
    baseDir: string;
  },
): string | undefined {
  /** Tagged logger scoped to this function so log lines identify the call site. */
  const rl = tagged({
    tag: resolveFrom.name,
    l,
  },);
  rl.info(`trying base ${baseDir}`,);
  try {
    /** CommonJS-style `require` anchored at a synthetic file under `baseDir` so Node resolves relative to that directory. */
    const require = createRequire(join(
      baseDir,
      'noop.js',
    ),);
    /** Absolute path returned by Node's resolver; logged before return for traceability. */
    const resolved = require.resolve(specifier,);
    rl.info(`resolved to ${resolved}`,);
    return resolved;
  }
  catch {
    rl.info(`not found in ${baseDir}`,);
    return undefined;
  }
}

/**
 * Finds the global node_modules directory by checking common global install locations.
 * Returns the path or `undefined` if none found.
 *
 * @returns Path to global node_modules, or `undefined`
 *
 * @example
 * ```ts
 * findGlobalNodeModules();
 * // => '/home/user/.bun/install/global/node_modules'
 * ```
 */
function findGlobalNodeModules(): string | undefined {
  /** Tagged logger scoped to this function so log lines identify the call site. */
  const rl = tagged({
    tag: findGlobalNodeModules.name,
    l,
  },);
  /** User's home directory; drives the per-user candidates below and is required for them to be meaningful. */
  const home = process.env['HOME'] ?? process.env['USERPROFILE'];
  if (home === undefined) {
    rl.info('no HOME or USERPROFILE set',);
    return undefined;
  }
  /** Candidate global node_modules paths, ordered by priority */
  const candidates = [
    join(
      home,
      '.bun',
      'install',
      'global',
      'node_modules',
    ),
    join(
      home,
      '.local',
      'lib',
      'node_modules',
    ),
    '/usr/local/lib/node_modules',
    '/usr/lib/node_modules',
  ];
  for (const candidate of candidates) {
    try {
      /** Lazy handle to the candidate's `.package-lock.json`; non-zero size confirms a real global install lives at this path. */
      const bunFile = Bun.file(join(
        candidate,
        '.package-lock.json',
      ),);
      if (bunFile.size > 0) {
        rl.info(`found global node_modules at ${candidate}`,);
        return candidate;
      }
    }
    catch {
      // Not here
    }
  }
  rl.info('no global node_modules found',);
  return undefined;
}

/**
 * Wraps {@link findMiseMonorepoRootCached} to swallow discovery errors and emit a single
 * diagnostic log instead. Returns the cached root or `undefined` when the helper throws
 * (i.e. when no `mise.toml` with `[monorepo]` exists above CWD).
 *
 * @returns Cached monorepo root, or `undefined` outside a monorepo
 *
 * @example
 * ```ts
 * const root = await tryFindMiseMonorepoRoot();
 * // => '/home/user/Monochromatic' (or undefined outside a workspace)
 * ```
 */
async function tryFindMiseMonorepoRoot(): Promise<string | undefined> {
  /** Tagged logger scoped to this helper so the "no monorepo root" log identifies the call site. */
  const rl = tagged({
    tag: tryFindMiseMonorepoRoot.name,
    l,
  },);
  try {
    return await findMiseMonorepoRootCached();
  }
  catch {
    rl.info('no monorepo root found',);
    return undefined;
  }
}

/**
 * Resolves an ESM specifier by searching CWD node_modules, monorepo root node_modules,
 * and global node_modules in that order.
 *
 * @param specifier - Bare import specifier to resolve
 *
 * @returns Resolved file path
 *
 * @throws When the specifier cannot be resolved from any location
 *
 * @example
 * ```ts
 * await resolveSpecifier({ specifier: 'lodash' });
 * // => '/home/user/project/node_modules/lodash/lodash.js'
 * ```
 */
export async function resolveSpecifier(
  { specifier, }: { specifier: string; },
): Promise<string> {
  /** Tagged logger scoped to this function so log lines identify the call site. */
  const rl = tagged({
    tag: resolveSpecifier.name,
    l,
  },);
  /** Process working directory; first resolution candidate, also reused in the not-found error message. */
  const cwd = process.cwd();

  //region CWD resolution
  rl.info(`resolving "${specifier}" from CWD: ${cwd}`,);
  /** Result of the CWD resolution attempt; returned eagerly when defined so monorepo and global lookups are skipped. */
  const fromCwd = resolveFrom({
    specifier,
    baseDir: cwd,
  },);
  if (fromCwd !== undefined)
    return fromCwd;
  //endregion CWD resolution

  //region Monorepo root resolution
  /**
   * Cached monorepo root populated by {@link findMiseMonorepoRootCached}.
   *
   * Stays `undefined` outside a monorepo or when discovery throws; reused below to
   * render the diagnostic line for the not-found error.
   */
  const monorepoRoot = await tryFindMiseMonorepoRoot();
  if ((monorepoRoot !== undefined) && (monorepoRoot !== cwd)) {
    rl.info(`trying monorepo root: ${monorepoRoot}`,);
    /** Result of resolution anchored at the monorepo root; tried only when the root differs from CWD. */
    const fromMonorepo = resolveFrom({
      specifier,
      baseDir: monorepoRoot,
    },);
    if (fromMonorepo !== undefined)
      return fromMonorepo;
  }
  //endregion Monorepo root resolution

  //region Global resolution
  /** Detected global `node_modules` path; final fallback when project-local resolution fails. */
  const globalDir = findGlobalNodeModules();
  if (globalDir !== undefined) {
    rl.info(`trying global: ${globalDir}`,);
    /** Result of resolution anchored one level above the global `node_modules` so Node's `require` discovers packages installed there. */
    const fromGlobal = resolveFrom({
      specifier,
      baseDir: join(
        globalDir,
        '..',
      ),
    },);
    if (fromGlobal !== undefined)
      return fromGlobal;
  }
  //endregion Global resolution

  /** Diagnostic line included in the thrown error only when a monorepo root was discovered. */
  const monorepoLine = monorepoRoot !== undefined
    ? `  - Monorepo root: ${monorepoRoot}\n`
    : '';
  /** Diagnostic line included in the thrown error only when a global `node_modules` was detected. */
  const globalLine = globalDir !== undefined ? `  - Global: ${globalDir}\n` : '';
  throw new Error(
    `Cannot resolve "${specifier}" from any of:\n  - CWD: ${cwd}\n${monorepoLine}${globalLine}Install the package first (e.g. bun add <package>)`,
  );
}
