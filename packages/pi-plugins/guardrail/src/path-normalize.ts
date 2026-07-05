/**
 * Tool path extraction and normalization for pi guardrail.
 *
 * @module
 */

import {
  relative,
  resolve,
  sep,
} from 'node:path';

import { isRecord, } from './value.ts';

//region Sentinels

/**
 * Sentinel returned when tool input lacks a usable path.
 *
 * @example
 * ```typescript
 * if (path === TOOL_PATH_NOT_FOUND) return GUARDRAIL_NOT_BLOCKED;
 * ```
 */
const TOOL_PATH_NOT_FOUND: unique symbol = Symbol('pi-guardrail/tool-path-not-found',);

/**
 * Sentinel returned when a path cannot be matched relative to cwd.
 *
 * @example
 * ```typescript
 * if (path === TOOL_PATH_NOT_MATCHABLE) return GUARDRAIL_NOT_BLOCKED;
 * ```
 */
const TOOL_PATH_NOT_MATCHABLE: unique symbol = Symbol('pi-guardrail/tool-path-not-matchable',);

//endregion Sentinels

//region Path normalization

/**
 * Extracts `path` from external pi edit/write input.
 *
 * @param input - unknown tool input
 *
 * @returns string path when present, otherwise {@link TOOL_PATH_NOT_FOUND}
 *
 * @example
 * ```typescript
 * extractToolPath({ path: 'pnpm-lock.yaml' });
 * ```
 */
function extractToolPath(input: unknown,): string | typeof TOOL_PATH_NOT_FOUND {
  if (!isRecord(input,))
    return TOOL_PATH_NOT_FOUND;
  /**
   * Raw path candidate from tool input.
   */
  const { path, } = input;
  return ((typeof path) === 'string')
    ? path
    : TOOL_PATH_NOT_FOUND;
}

/**
 * Normalizes pi tool paths to relative POSIX pathnames accepted by `ignore`.
 *
 * Built-in tools strip a leading `@` before resolving; this guard mirrors that
 * behavior so model-produced file references and plain paths match identically.
 * Paths outside `cwd` are left unguarded because global gitignore-style rules
 * are evaluated relative to the active project root.
 *
 * @param cwd - pi current working directory
 *
 * @param rawPath - raw path from tool input
 *
 * @returns relative POSIX path under cwd, or {@link TOOL_PATH_NOT_MATCHABLE} for outside/empty paths
 *
 * @example
 * ```typescript
 * normalizeToolPath({ cwd: '/repo', rawPath: '/repo/pnpm-lock.yaml' });
 * ```
 */
function normalizeToolPath(
  {
    cwd,
    rawPath,
  }: {
    readonly cwd: string;
    readonly rawPath: string;
  },
): string | typeof TOOL_PATH_NOT_MATCHABLE {
  /**
   * Path after mirroring pi built-in file-reference normalization.
   */
  const unprefixedPath = rawPath.startsWith('@',)
    ? rawPath.slice(1,)
    : rawPath;
  if (unprefixedPath.length === 0)
    return TOOL_PATH_NOT_MATCHABLE;

  /**
   * Absolute target path resolved against pi cwd.
   */
  const absolutePath = resolve(
    cwd,
    unprefixedPath,
  );
  /**
   * Relative target path from pi cwd.
   */
  const relativePath = relative(
    cwd,
    absolutePath,
  );
  if ((relativePath.length === 0)
    || (relativePath === '..')
    || relativePath.startsWith(`..${sep}`,)) {
    return TOOL_PATH_NOT_MATCHABLE;
  }

  return relativePath
    .split(sep,)
    .join('/',);
}

//endregion Path normalization

export {
  extractToolPath,
  normalizeToolPath,
  TOOL_PATH_NOT_FOUND,
  TOOL_PATH_NOT_MATCHABLE,
};
