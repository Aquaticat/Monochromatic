#!/usr/bin/env node

/**
 * CLI entry point for bringing a WireGuard interface up or down without the
 * quadratic bash config parsing that makes `wg-quick` hang on a large
 * `AllowedIPs` value.
 *
 * @example
 * ```sh
 * wg-quicker up mx-que-mx1
 * wg-quicker down mx-que-mx1
 * ```
 *
 * @module
 */

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { loadConfig, } from './config.ts';
import { CliUsageError, } from './errors.ts';
import {
  down,
  up,
} from './tunnel.ts';

/**
 * Module logger for command lifecycle.
 */
const l = tagged({ tag: 'wg-quicker', },);

/**
 * Recognized subcommands.
 */
type Subcommand = 'up' | 'down';

/**
 * Parsed command-line contract.
 */
type CliArgs = {
  readonly subcommand: Subcommand;
  readonly target: string;
};

/**
 * Parses the two-positional-argument contract: `<up|down> <interface|path>`.
 *
 * @param argv - Arguments after runtime and script path.
 *
 * @returns Validated subcommand and target.
 *
 * @throws {@link CliUsageError} when arguments are missing or the subcommand is unknown.
 *
 * @example
 * ```ts
 * parseCliArgs({ argv: ['up', 'mx-que-mx1'] });
 * ```
 */
function parseCliArgs({ argv, }: { readonly argv: readonly string[]; },): CliArgs {
  /**
   * Positional subcommand and config target extracted from argv.
   */
  const [subcommand, target,] = argv;
  if ((subcommand === undefined) || ((subcommand !== 'up') && (subcommand !== 'down'))) {
    l.error('first argument must be up or down',);
    throw new CliUsageError('Usage: wg-quicker <up|down> <interface|config-path>',);
  }
  if (target === undefined) {
    l.error('missing interface or config path',);
    throw new CliUsageError('Usage: wg-quicker <up|down> <interface|config-path>',);
  }
  return {
    subcommand,
    target,
  };
}

/**
 * Arguments after runtime and script path.
 */
const processArguments = process.argv
  .slice(2,);

/**
 * Parsed subcommand and config target.
 */
const {
  subcommand,
  target,
} = parseCliArgs({ argv: processArguments, },);

l.debug(`${subcommand} ${target}`,);

/**
 * Parsed config for the requested interface.
 */
const config = await loadConfig({ arg: target, },);

await (subcommand === 'up' ? up({ config, },) : down({ config, },));
