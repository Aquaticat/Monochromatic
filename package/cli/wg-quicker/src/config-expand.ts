import { readFile, } from 'node:fs/promises';

import { generateAllowedIps, } from '@monochromatic-dev/cli-wg-allowedips/ts';

import type { WireguardConfig, } from './config.ts';

/**
 * Expands `AllowedIPsFromFiles` into a real `AllowedIPs` peer line.
 *
 * Reads the allowed and disallowed files, computes the minimized prefix set via
 * `wg-allowedips` (constant-time CIDR math, never bash), and appends the result
 * as an `AllowedIPs` line inside the forwarded peer block.
 *
 * @param config - Parsed config carrying the file paths.
 *
 * @returns Config whose `wgConfig` ends with the expanded `AllowedIPs` line.
 *
 * @example
 * ```ts
 * await expandAllowedFromFiles({ config });
 * ```
 */
export async function expandAllowedFromFiles(
  { config, }: { readonly config: WireguardConfig; },
): Promise<WireguardConfig> {
  /**
   * File paths, present by the caller's guard.
   */
  const files = config.allowedFromFiles;
  if (files === undefined)
    return config;
  /**
   * Minimized allowed-prefix text computed from the two files.
   */
  const allowedIps = await generateAllowedIps({
    allowedText: await readFile(
      files.allowed,
      'utf8',
    ),
    disallowedText: await readFile(
      files.disallowed,
      'utf8',
    ),
  },);
  /**
   * Trimmed comma-separated prefix list for the peer line.
   */
  const value = allowedIps.trim();
  if (value === '')
    return config;
  return {
    ...config,
    wgConfig: `${config.wgConfig}AllowedIPs = ${value}\n`,
  };
}
