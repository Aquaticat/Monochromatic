import { homedir, } from 'node:os';

import { ConfigError, } from './errors.ts';
import {
  splitWords,
  trimLinear,
} from './text.ts';

/**
 * Paths parsed from one peer's `AllowedIPsFromFiles` value.
 */
export type AllowedFromFilesPaths = {
  /**
   * File containing allowed address-set entries.
   */
  readonly allowed: string;

  /**
   * File containing disallowed address-set entries.
   */
  readonly disallowed: string;
};

/**
 * Strips inline comment and trims without regular expression.
 *
 * @param line - Raw config line.
 *
 * @returns Content before first comment introducer.
 *
 * @example
 * ```ts
 * stripComment({ line: 'Address = 10.0.0.1/32 # tunnel' });
 * ```
 */
export function stripComment(
  { line, }: { readonly line: string; },
): string {
  /**
   * First comment introducer or absent index.
   */
  const hash = line.indexOf('#',);
  return trimLinear({ value: hash === (-1) ? line : line.slice(
    0,
    hash,
  ), },);
}

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
): AllowedFromFilesPaths {
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
 * Reports whether DNS token is IP literal rather than search domain.
 *
 * @param token - One comma-separated DNS token.
 *
 * @returns True when token is digits/dots or contains IPv6 colon.
 *
 * @example
 * ```ts
 * isIpLiteral({ token: '198.245.51.147' });
 * ```
 */
export function isIpLiteral(
  { token, }: { readonly token: string; },
): boolean {
  if (token.includes(':',))
    return true;
  // oxlint-disable-next-line no-restricted-syntax/no-regex -- Anchored IPv4 token classification on short DNS field avoids rescanning giant AllowedIPs values and has no backtracking.
  return /^[0-9.]+$/u.test(token,);
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
