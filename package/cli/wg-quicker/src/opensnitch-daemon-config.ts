import { readFile, } from 'node:fs/promises';

import { OpenSnitchConfigError, } from './errors.ts';

/**
 * OpenSnitch release default daemon config path.
 */
const DEFAULT_DAEMON_CONFIG = '/etc/opensnitchd/default-config.json';

/**
 * Environment override for custom OpenSnitch daemon config and fixtures.
 */
export const OPENSNITCH_DAEMON_CONFIG_ENVIRONMENT = 'WG_QUICKER_OPENSNITCH_DAEMON_CONFIG';

/**
 * Reports non-null JSON object.
 *
 * @param value - Unknown JSON value.
 *
 * @returns Whether value is record-like.
 *
 * @example
 * ```ts
 * isRecord({ Firewall: 'nftables' });
 * ```
 */
function isRecord(value: unknown,): value is Readonly<Record<string, unknown>> {
  if ((typeof value) !== 'object')
    return false;
  if (value === null)
    return false;
  return !Array.isArray(value,);
}

/**
 * Resolves OpenSnitch daemon config path.
 *
 * @returns Explicit override or release default.
 *
 * @example
 * ```ts
 * openSnitchDaemonConfigPath();
 * ```
 */
function openSnitchDaemonConfigPath(): string {
  /**
   * Explicit custom daemon config path when configured.
   */
  const configured = process.env[OPENSNITCH_DAEMON_CONFIG_ENVIRONMENT];
  return (configured === undefined) || (configured === '')
    ? DEFAULT_DAEMON_CONFIG
    : configured;
}

/**
 * Reads daemon config with integration-specific diagnostic.
 *
 * @param path - Effective daemon config path.
 *
 * @returns Raw daemon JSON.
 *
 * @throws {@link OpenSnitchConfigError} when file is unreadable.
 *
 * @example
 * ```ts
 * await readDaemonConfig({ path: '/etc/opensnitchd/default-config.json' });
 * ```
 */
async function readDaemonConfig(
  { path, }: { readonly path: string; },
): Promise<string> {
  try {
    return await readFile(
      path,
      'utf8',
    );
  }
  catch (error) {
    throw new OpenSnitchConfigError(
      `Cannot read OpenSnitch daemon config to verify nftables backend: ${path}`,
      { cause: error, },
    );
  }
}

/**
 * Parses daemon config with integration-specific diagnostic.
 *
 * @param text - Raw daemon JSON.
 *
 * @param path - Effective daemon config path.
 *
 * @returns Unknown parsed value.
 *
 * @throws {@link OpenSnitchConfigError} when JSON syntax is invalid.
 *
 * @example
 * ```ts
 * parseDaemonConfig({ text: '{"Firewall":"nftables"}', path: '/tmp/default-config.json' });
 * ```
 */
function parseDaemonConfig(
  {
    text,
    path,
  }: {
    readonly text: string;
    readonly path: string;
  },
): unknown {
  try {
    return JSON.parse(text,);
  }
  catch (error) {
    throw new OpenSnitchConfigError(
      `OpenSnitch daemon config is not valid JSON: ${path}`,
      { cause: error, },
    );
  }
}

/**
 * Requires OpenSnitch nftables backend before writing nftables system rules.
 *
 * @throws {@link OpenSnitchConfigError} when daemon config is unreadable,
 * malformed,
 * or selects unsupported backend.
 *
 * @example
 * ```ts
 * await assertOpenSnitchNftablesBackend();
 * ```
 */
export async function assertOpenSnitchNftablesBackend(): Promise<void> {
  /**
   * Effective daemon configuration path.
   */
  const path = openSnitchDaemonConfigPath();
  /**
   * Parsed daemon configuration candidate.
   */
  const parsed = parseDaemonConfig({
    text: await readDaemonConfig({ path, },),
    path,
  },);
  if ((!isRecord(parsed,)) || (parsed.Firewall !== 'nftables')) {
    throw new OpenSnitchConfigError(
      `wg-quicker OpenSnitch auto-configuration requires Firewall = nftables in ${path}.`,
    );
  }
}
