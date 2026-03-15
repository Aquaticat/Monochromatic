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
 */
export function getArgumentValue(name: string,): string | undefined {
  const prefix = `--${name}=`;
  const argument = process.argv.find(function hasPrefix(entry,) {
    return entry.startsWith(prefix,);
  },);
  return argument?.slice(prefix.length,);
}
