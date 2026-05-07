/**
 * CLI argument parsing utilities.
 *
 * Shared between `index.ts` (port resolution) and `data/db.ts` (database path)
 * to avoid duplicating the `--name=value` extraction logic.
 * Mirrors `packages/webapp-content/messages-demo/src/lib/args.ts`.
 */

/**
 * Extracts the value of a `--name=value` CLI argument from `process.argv`.
 *
 * @param name - argument name without the `--` prefix
 *
 * @returns extracted value, or `undefined` when the argument is absent
 *
 * @example
 * ```ts
 * const port = getArgumentValue('port'); // '3000' when invoked with --port=3000
 * ```
 */
export function getArgumentValue(name: string,): string | undefined {
  const prefix = `--${name}=`;
  const argument = process.argv.find(function hasPrefix(entry,) {
    return entry.startsWith(prefix,);
  },);
  return argument?.slice(prefix.length,);
}
