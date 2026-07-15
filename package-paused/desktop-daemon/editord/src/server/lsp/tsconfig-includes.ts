/**
 * Resolves and caches tsconfig `include` patterns for project roots.
 *
 * Runs `tsc --showConfig` to get the fully resolved configuration
 * (with `${configDir}` substitution and `extends` chain applied),
 * then checks file paths against the resolved glob patterns using
 * `path.matchesGlob`. This prevents editord from sending files to
 * tsc that fall outside the project's declared include scope,
 * a defense against tsc panicking on non-source files it discovers
 * during project loading.
 */

import {
  delimiter,
  join,
  matchesGlob,
} from 'node:path';

import spawn from 'nano-spawn';

import type { Logger, } from '../log.ts';

/**
 * Cache entry with a timestamp for TTL-based eviction.
 */
type IncludesCacheEntry = {
  /**
   * Resolved absolute glob patterns from tsconfig `include`.
   */
  readonly patterns: readonly string[];
  /**
   * Timestamp when the entry was stored (milliseconds since epoch).
   */
  readonly storedAt: number;
};

/**
 * Time-to-live for cached entries (milliseconds).
 */
const CACHE_TTL_MS = 120_000;

/**
 * Cached resolved includes keyed by project root path.
 */
const includesCache = new Map<string, IncludesCacheEntry>();

/**
 * Resolves the tsconfig `include` patterns for a project root.
 *
 * Spawns `tsc --showConfig` in the project directory and parses
 * the JSON output to extract the fully resolved `include` array.
 * Results are cached with a TTL so config changes are picked up
 * without restarting the server.
 *
 * @param root - absolute path to the project root (directory containing tsconfig.json)
 *
 * @param l - logger for error reporting
 *
 * @returns array of resolved absolute glob patterns, or empty array on failure
 *
 * @example
 * ```ts
 * const patterns = await resolveTsconfigIncludes({
 *   root: '/home/user/project',
 *   l: logger,
 * });
 * // ['/home/user/project/src/**\/*.ts', '/home/user/project/*.config.ts']
 * ```
 */
export async function resolveTsconfigIncludes({
  root,
  l,
}: {
  readonly root: string;
  readonly l: Logger;
},): Promise<readonly string[]> {
  /**
   * TTL-gated reuse below avoids respawning tsc for repeated queries.
   */
  const cached = includesCache.get(root,);
  if ((cached !== undefined) && ((Date.now()
    - cached
    .storedAt) < CACHE_TTL_MS))
    return cached.patterns;

  try {
    /**
     * Project-local bin dir prepended to PATH so workspace tsc resolves first.
     */
    const binPath = join(
      root,
      'node_modules/.bin',
    );
    /**
     * tsc --showConfig stdout; parsed as the project's resolved tsconfig.
     */
    const result = await spawn(
      'tsc',
      ['--showConfig',],
      {
        cwd: root,
        env: {
          ...process.env,
          PATH: `${binPath}${delimiter}${process.env
            .PATH
            ?? ''}`,
        },
      },
    );

    /* oxlint-disable typescript-eslint/no-unsafe-type-assertion -- tsc --showConfig always returns { include?: string[] } */
    /**
     * Parsed tsconfig payload narrowed to the `include` field used below.
     */
    const config = JSON.parse(result.output,) as {
      readonly include?: string[];
    };
    /* oxlint-enable typescript-eslint/no-unsafe-type-assertion */
    /**
     * Empty fallback so the cache stores a usable array even for unconfigured projects.
     */
    const patterns = config.include
      ?? [];

    includesCache.set(
      root,
      {
        patterns,
        storedAt: Date.now(),
      },
    );
    l.info(`resolved ${String(patterns.length,)} tsconfig include patterns for ${root}`,);
    return patterns;
  }
  catch (error) {
    l.error(`failed to resolve tsconfig includes for ${root}: ${String(error,)}`,);
    /**
     * Return empty array on failure; caller should allow the file through as a safe fallback.
     */
    return [];
  }
}

/**
 * Checks whether a file path matches any of the resolved tsconfig include patterns.
 *
 * When no patterns are available (empty array), returns true as a safe fallback
 * so files are not silently dropped when include resolution fails.
 *
 * @param path - absolute file path to check
 *
 * @param patterns - resolved include patterns from {@link resolveTsconfigIncludes}
 *
 * @returns true when the path matches at least one pattern, or patterns are empty
 *
 * @example
 * ```ts
 * matchesTsconfigIncludes({
 *   path: '/home/user/project/src/index.ts',
 *   patterns: ['/home/user/project/src/**\/*.ts'],
 * });
 * // true
 *
 * matchesTsconfigIncludes({
 *   path: '/home/user/project/architecture.svg',
 *   patterns: ['/home/user/project/src/**\/*.ts'],
 * });
 * // false
 * ```
 */
export function matchesTsconfigIncludes({
  path,
  patterns,
}: {
  readonly path: string;
  readonly patterns: readonly string[];
},): boolean {
  /**
   * Safe fallback: if resolution failed (empty patterns), allow everything through.
   */
  if (patterns.length
    === 0)
    return true;

  return patterns.some(
    function checkPattern(pattern,): boolean {
      return matchesGlob(
        path,
        pattern,
      );
    },
  );
}
