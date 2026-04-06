/**
 * Pure filtering functions for pnpm output.
 *
 * The monorepo has an intentional cyclic workspace dependency between
 * `packages/module/es` and `packages/module/test`.
 * pnpm lacks a per-package allowlist for cycle warnings --
 * the only built-in options are `ignoreWorkspaceCycles` (all or nothing)
 * and `disallowWorkspaceCycles`.
 * These functions selectively identify and remove the known cycle warning
 * while preserving any future cycle warnings from unexpected packages.
 *
 * pnpm writes the cycle warning to **stdout** (verified empirically),
 * so the CLI wrapper applies this filter to both streams.
 */

//region Known cycle allowlist

/**
 * Set of workspace directory suffixes that form an intentional dependency cycle.
 *
 * When a cycle warning mentions **only** packages in this set, it is suppressed.
 * If any package outside this set appears in a cycle warning, it passes through.
 *
 * @example
 * ```ts
 * ALLOWED_CYCLE_PACKAGES.has('packages/module/es');
 * // true
 * ```
 */
const ALLOWED_CYCLE_PACKAGES: ReadonlySet<string> = new Set([
  'packages/module/es',
  'packages/module/test',
],);

//endregion Known cycle allowlist

//region Warning filtering

/**
 * Prefix that pnpm uses for the cyclic workspace dependency warning.
 *
 * @example
 * ```ts
 * CYCLE_WARNING_PREFIX === '\u2009WARN\u2009 There are cyclic workspace dependencies: ';
 * ```
 */
// pnpm uses U+2009 THIN SPACE around "WARN" in its formatted output
const CYCLE_WARNING_PREFIX = '\u2009WARN\u2009 There are cyclic workspace dependencies: ';

/**
 * Tests whether a stderr line is a known-benign cycle warning that should be suppressed.
 *
 * Extracts the package paths from the warning and checks whether every path
 * (after stripping the monorepo root prefix) belongs to {@link ALLOWED_CYCLE_PACKAGES}.
 *
 * @param line - single line of pnpm output
 *
 * @returns true when the warning should be suppressed
 *
 * @example
 * ```ts
 * isAllowedCycleWarning(' WARN  There are cyclic workspace dependencies: /home/user/Monochromatic/packages/module/es, /home/user/Monochromatic/packages/module/test');
 * // true
 * isAllowedCycleWarning(' WARN  There are cyclic workspace dependencies: /home/user/Monochromatic/packages/foo, /home/user/Monochromatic/packages/bar');
 * // false
 * ```
 */
export function isAllowedCycleWarning(line: string,): boolean {
  if (!line.includes(CYCLE_WARNING_PREFIX,))
    return false;

  const afterPrefix = line.slice(
    line.indexOf(CYCLE_WARNING_PREFIX,) + CYCLE_WARNING_PREFIX.length,
  );
  const paths = afterPrefix.split(', ',);

  return paths.length > 0 && paths.every(function checkPath(rawPath,) {
    const trimmed = rawPath.trim();
    if (trimmed.length === 0)
      return false;
    // Strip everything up to and including the first `packages/` occurrence
    // to normalize absolute paths from any monorepo root location.
    const packagesIndex = trimmed.indexOf('packages/',);
    if (packagesIndex === -1)
      return false;
    const relativePath = trimmed.slice(packagesIndex,);
    return ALLOWED_CYCLE_PACKAGES.has(relativePath,);
  },);
}

/**
 * Filters pnpm output, removing only known-benign cycle warnings.
 *
 * @param output - raw pnpm stdout or stderr content
 *
 * @returns filtered output with allowed cycle warnings removed
 *
 * @example
 * ```ts
 * filterPnpmOutput(' WARN  There are cyclic workspace dependencies: /abs/packages/module/es, /abs/packages/module/test\nother warning\n');
 * // 'other warning\n'
 * ```
 */
export function filterPnpmOutput(output: string,): string {
  if (output.length === 0)
    return '';

  const lines = output.split('\n',);
  const kept = lines.filter(function keepLine(line,) {
    return !isAllowedCycleWarning(line,);
  },);

  return kept.join('\n',);
}

//endregion Warning filtering
