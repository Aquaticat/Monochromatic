#!/usr/bin/env node

/**
 * CLI entry point for generating a WireGuard `AllowedIPs` value.
 *
 * @example
 * ```sh
 * wg-allowedips --allowed allowed.txt --disallowed disallowed.txt
 * ```
 *
 * @module
 */

import { readFile, } from 'node:fs/promises';
import { parseArgs, } from 'node:util';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { CliUsageError, } from './errors.ts';
import { generateAllowedIps, } from './generate.ts';

/**
 * Required input paths parsed from command-line arguments.
 */
type CliPaths = {
  readonly allowedPath: string;
  readonly disallowedPath: string;
};

/**
 * Module logger for command lifecycle.
 */
const l = tagged({ tag: 'wg-allowedips', },);

/**
 * Reads one required string option or raises a command-contract error.
 *
 * @param flag - Option name included in an error.
 *
 * @param value - Parsed option value when supplied.
 *
 * @returns Required path value.
 *
 * @throws {@link CliUsageError} when the option is absent.
 *
 * @example
 * ```ts
 * requiredPath({ flag: '--allowed', value: 'allowed.txt' });
 * // => 'allowed.txt'
 * ```
 */
function requiredPath(
  {
    flag,
    value,
  }: {
    readonly flag: string;
    readonly value: string | undefined;
  },
): string {
  if (value === undefined) {
    l.error(`missing required option ${flag}`,);
    throw new CliUsageError(`Missing required option: ${flag}`,);
  }
  return value;
}

/**
 * Parses the exact two-option command contract.
 *
 * @param argv - Arguments after runtime and script path.
 *
 * @returns Required allowed and disallowed file paths.
 *
 * @throws {@link CliUsageError} when either required option is absent.
 *
 * @example
 * ```ts
 * parseCliPaths({ argv: ['--allowed', 'a.txt', '--disallowed', 'd.txt'] });
 * ```
 */
function parseCliPaths({ argv, }: { readonly argv: readonly string[]; },): CliPaths {
  /**
   * Values parsed by Node's strict built-in argument parser.
   */
  const { values, } = parseArgs({
    args: [...argv,],
    allowPositionals: false,
    strict: true,
    options: {
      allowed: { type: 'string', },
      disallowed: { type: 'string', },
    },
  },);
  return {
    allowedPath: requiredPath({ flag: '--allowed', value: values.allowed, },),
    disallowedPath: requiredPath({ flag: '--disallowed', value: values.disallowed, },),
  };
}

/**
 * Parsed file paths from process arguments.
 */
const {
  allowedPath,
  disallowedPath,
} = parseCliPaths({ argv: process.argv.slice(2,), },);
l.debug(`reading allowed input from ${allowedPath}`,);
l.debug(`reading disallowed input from ${disallowedPath}`,);
/**
 * Complete allowed and disallowed file texts read concurrently.
 */
const [allowedText, disallowedText,] = await Promise.all([
  readFile(allowedPath, 'utf8',),
  readFile(disallowedPath, 'utf8',),
],);
/**
 * Exact stdout payload generated from both files.
 */
const output = await generateAllowedIps({ allowedText, disallowedText, },);
l.debug(`writing ${String(output.length,)} stdout byte(s)`,);
process.stdout.write(output,);
