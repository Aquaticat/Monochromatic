/**
 * CLI argument parsing utilities.
 *
 * Shared between `server.ts` (port resolution) and `lib/db.ts` (database path resolution)
 * to avoid duplicating the `--name=value` extraction logic.
 */

/**
 * Extracts the value of a `--name=value` CLI argument from `process.argv`.
 *
 * @param name - Argument name without the `--` prefix
 *
 * @returns Extracted value, or `undefined` when the argument is absent
 *
 * @example
 * ```ts
 * const port = getArgumentValue('port');
 * // '3000' when invoked with --port=3000
 * ```
 */
export function getArgumentValue(name: string,): string | undefined {
  /** Search prefix built once so the predicate closure stays cheap. */
  const prefix = `--${name}=`;
  /** First argv entry that opens with `--name=`; undefined when absent. */
  const argument = process.argv.find(function hasPrefix(entry,) {
    return entry.startsWith(prefix,);
  },);
  return argument?.slice(prefix.length,);
}
