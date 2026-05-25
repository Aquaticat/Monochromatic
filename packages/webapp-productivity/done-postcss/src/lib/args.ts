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
 * const port = getArgumentValue('port'); // '3000' when invoked with --port=3000
 * ```
 */
export function getArgumentValue(name: string,): string | undefined {
  /** Match string for the `--name=` portion preceding the value. */
  const prefix = `--${name}=`;
  /** First `process.argv` entry starting with the prefix, if any. */
  const argument = process.argv
    .find(function hasPrefix(entry,) {
    return entry.startsWith(prefix,);
  },);
  return argument?.slice(prefix.length,);
}
