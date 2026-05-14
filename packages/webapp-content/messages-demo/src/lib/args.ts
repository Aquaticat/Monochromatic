/**
 * CLI argument parsing utilities.
 *
 * Shared between `server.ts` (port resolution), `lib/db.ts` (database path),
 * and `lib/seed.ts` (seed flags) to avoid duplicating the `--name=value`
 * extraction logic. Mirrors `packages/webapp-productivity/done/src/lib/args.ts:20`.
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
  /** Computed once so the closure passed to `find` does not rebuild it per element. */
  const prefix = `--${name}=`;
  /** Captured separately so the return can slice off `prefix.length` without re-finding. */
  const argument = process.argv.find(function hasPrefix(entry,) {
    return entry.startsWith(prefix,);
  },);
  return argument?.slice(prefix.length,);
}
