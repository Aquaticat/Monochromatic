import { homedir, } from 'node:os';

import { ConfigError, } from './errors.ts';
import type { AllowedFromFiles, } from './config.ts';
import { splitWords, } from './text.ts';

/**
 * Parses the `AllowedIPsFromFiles` value into its two file paths.
 *
 * @param value - Raw value text, expected `allowed.txt disallowed.txt`.
 *
 * @returns The two file paths.
 *
 * @throws {@link ConfigError} when the value does not name exactly two paths.
 *
 * @example
 * ```ts
 * parseAllowedFromFiles({ value: '~/allowed.txt ~/disallowed.txt' });
 * ```
 */
export function parseAllowedFromFiles(
  { value, }: { readonly value: string; },
): AllowedFromFiles {
  /**
   * Whitespace-separated path tokens.
   */
  const parts = splitWords({ line: value, },);
  /**
   * Destructured allowed path, disallowed path, and any rejected extra tokens.
   */
  const [allowed, disallowed, ...rest] = parts;
  if ((allowed === undefined) || (disallowed === undefined)
    || (rest.length > 0)) {
    throw new ConfigError(
      `Invalid \`AllowedIPsFromFiles' value \`${value}': expected exactly two paths (allowed, disallowed)`,
    );
  }
  return {
    allowed: expandHome({ path: allowed, },),
    disallowed: expandHome({ path: disallowed, },),
  };
}

/**
 * Expands a leading `~` in a file path to the current user's home directory.
 *
 * @param path - Path possibly starting with `~` or `~/`.
 *
 * @returns The absolute path with the home directory substituted.
 *
 * @example
 * ```ts
 * expandHome({ path: '~/allowed.txt' });
 * ```
 */
export function expandHome({ path, }: { readonly path: string; },): string {
  if (path === '~')
    return homedir();
  if (path.startsWith('~/',))
    return `${homedir()}${path.slice(1,)}`;
  return path;
}

/**
 * Parses a positive integer interface option, rejecting non-numeric input.
 *
 * @param key - Option name used in the error message.
 *
 * @param value - Raw value text from the config file.
 *
 * @returns The parsed positive integer.
 *
 * @throws {@link ConfigError} when the value is not a positive integer.
 *
 * @example
 * ```ts
 * parsePositiveInt({ key: 'MTU', value: '1420' });
 * ```
 */
export function parsePositiveInt(
  {
    key,
    value,
  }: {
    readonly key: string;
    readonly value: string;
  },
): number {
  /**
   * Numeric value before the integer check.
   */
  const parsed = Number(value,);
  if ((!Number.isSafeInteger(parsed,)) || (parsed <= 0)) {
    throw new ConfigError(`Invalid \`${key}' value \`${value}': expected a positive integer`,);
  }
  return parsed;
}
