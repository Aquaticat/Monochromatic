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

//region Path normalization

/**
 * Extracts `path` from external pi edit/write input.
 *
 * @param input - unknown tool input
 *
 * @returns string path when present
 *
 * @example
 * ```typescript
 * extractToolPath({ path: 'pnpm-lock.yaml' });
 * ```
 */
function extractToolPath(input: unknown,): string | undefined {
  if (!isRecord(input,))
    return undefined;
  /**
   * Raw path candidate from tool input.
   */
  const path = input.path;
  return ((typeof path) === 'string')
    ? path
    : undefined;
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
 * @returns relative POSIX path under cwd, or `undefined` for outside/empty paths
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
): string | undefined {
  /**
   * Path after mirroring pi built-in file-reference normalization.
   */
  const unprefixedPath = rawPath.startsWith('@',)
    ? rawPath.slice(1,)
    : rawPath;
  if (unprefixedPath.length === 0)
    return undefined;

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
    return undefined;
  }

  return relativePath
    .split(sep,)
    .join('/',);
}

/**
 * Returns whether value is a non-array object record.
 *
 * @param value - value to inspect
 *
 * @returns whether value can expose a path field
 */
function isRecord(value: unknown,): value is Readonly<Record<string, unknown>> {
  return (value !== null)
    && ((typeof value) === 'object')
    && (!Array.isArray(value,));
}

//endregion Path normalization

export {
  extractToolPath,
  normalizeToolPath,
};
