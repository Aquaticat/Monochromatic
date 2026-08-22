import {
  lstat,
  readFile,
  writeFile,
} from 'node:fs/promises';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { OpenSnitchConfigError, } from './errors.ts';
import { parseOpenSnitchConfig, } from './opensnitch-config-tree.ts';

/**
 * Module logger for OpenSnitch config persistence.
 */
const l = tagged({ tag: 'opensnitch-config-file', },);

/**
 * OpenSnitch release default system-firewall path.
 */
const DEFAULT_SYSTEM_FIREWALL_CONFIG = '/etc/opensnitchd/system-fw.json';

/**
 * Environment override for custom OpenSnitch daemon deployments and fixtures.
 */
export const OPENSNITCH_CONFIG_ENVIRONMENT = 'WG_QUICKER_OPENSNITCH_SYSTEM_FIREWALL_CONFIG';

/**
 * Sentinel indicating OpenSnitch system-firewall file is absent.
 */
export const OPENSNITCH_CONFIG_ABSENT: unique symbol = Symbol(
  'OpenSnitch system-firewall config absent',
);

/**
 * Reports whether unknown failure carries Node filesystem code.
 *
 * @param error - Unknown caught value.
 *
 * @returns Whether value is Node error with optional code.
 *
 * @example
 * ```ts
 * isErrnoException({ code: 'ENOENT' });
 * ```
 */
function isErrnoException(error: unknown,): error is NodeJS.ErrnoException {
  return Error.isError(error,);
}

/**
 * Resolves OpenSnitch system-firewall path.
 *
 * @returns Explicit override or release default.
 *
 * @example
 * ```ts
 * openSnitchConfigPath();
 * ```
 */
export function openSnitchConfigPath(): string {
  /**
   * Explicit custom system-firewall path when configured.
   */
  const configured = process.env[OPENSNITCH_CONFIG_ENVIRONMENT];
  return (configured === undefined) || (configured === '')
    ? DEFAULT_SYSTEM_FIREWALL_CONFIG
    : configured;
}

/**
 * Narrows config-read result to exact absence sentinel.
 *
 * @param value - Config text or absence symbol.
 *
 * @returns Whether OpenSnitch config path was absent.
 *
 * @example
 * ```ts
 * isOpenSnitchConfigAbsent(OPENSNITCH_CONFIG_ABSENT);
 * ```
 */
export function isOpenSnitchConfigAbsent(
  value: string | typeof OPENSNITCH_CONFIG_ABSENT,
): value is typeof OPENSNITCH_CONFIG_ABSENT {
  if ((typeof value) !== 'symbol')
    return false;
  return value === OPENSNITCH_CONFIG_ABSENT;
}

/**
 * Reads config when installed and rejects non-regular paths.
 *
 * @param path - OpenSnitch system-firewall config path.
 *
 * @returns Existing text or absence sentinel when OpenSnitch is not installed.
 *
 * @throws {@link OpenSnitchConfigError} when existing path cannot be read safely.
 *
 * @example
 * ```ts
 * await readOpenSnitchConfig({ path: '/etc/opensnitchd/system-fw.json' });
 * ```
 */
export async function readOpenSnitchConfig(
  { path, }: { readonly path: string; },
): Promise<string | typeof OPENSNITCH_CONFIG_ABSENT> {
  try {
    /**
     * Link metadata rejects symlink and hard-link replacement targets.
     */
    const metadata = await lstat(path,);
    if ((!metadata.isFile()) || (metadata.nlink !== 1)) {
      throw new OpenSnitchConfigError(
        `OpenSnitch system-firewall config must be one regular file with one link: ${path}`,
      );
    }
    return await readFile(
      path,
      'utf8',
    );
  }
  catch (error) {
    if (isErrnoException(error,) && (error.code === 'ENOENT'))
      return OPENSNITCH_CONFIG_ABSENT;
    throw new OpenSnitchConfigError(
      `Cannot read OpenSnitch system-firewall config: ${path}`,
      { cause: error, },
    );
  }
}

/**
 * Writes validated JSON through watched inode and restores original text after write failure.
 *
 * OpenSnitch 1.8 watches file inode for `Write`;
 * replacing path by rename can race its nftables reload.
 *
 * @param path - OpenSnitch system-firewall config path.
 *
 * @param original - Exact source text retained for recovery.
 *
 * @param rendered - Validated replacement text.
 *
 * @throws {@link OpenSnitchConfigError} when write or recovery fails.
 *
 * @example
 * ```ts
 * await writeOpenSnitchConfig({ path, original, rendered });
 * ```
 */
export async function writeOpenSnitchConfig(
  {
    path,
    original,
    rendered,
  }: {
    readonly path: string;
    readonly original: string;
    readonly rendered: string;
  },
): Promise<void> {
  parseOpenSnitchConfig({
    text: rendered,
    path,
  },);
  try {
    await writeFile(
      path,
      rendered,
      'utf8',
    );
  }
  catch (error) {
    l.error(`OpenSnitch config write failed at ${path}: ${String(error,)}`,);
    try {
      await writeFile(
        path,
        original,
        'utf8',
      );
    }
    catch (restoreError) {
      l.error(`OpenSnitch config recovery failed at ${path}: ${String(restoreError,)}`,);
      throw new OpenSnitchConfigError(
        `OpenSnitch system-firewall write and recovery failed: ${path}`,
        { cause: restoreError, },
      );
    }
    throw new OpenSnitchConfigError(
      `Cannot write OpenSnitch system-firewall config: ${path}`,
      { cause: error, },
    );
  }
  /**
   * Persisted content parsed again from disk before network setup continues.
   */
  const persisted = await readFile(
    path,
    'utf8',
  );
  parseOpenSnitchConfig({
    text: persisted,
    path,
  },);
}
