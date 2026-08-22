import {
  lstat,
  mkdir,
  readFile,
  writeFile,
} from 'node:fs/promises';

import { wait, } from '@monochromatic-dev/module-async-time/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { OpenSnitchConfigError, } from './errors.ts';
import { claimOperationLock, } from './operation-lock.ts';
import {
  parseOpenSnitchConfig,
  reconcileOpenSnitchConfig,
  renderOpenSnitchConfig,
} from './opensnitch-config-tree.ts';
import { runAllowingFailure, } from './runner.ts';
import {
  bypassRuntimeDirectory,
  bypassStateKey,
} from './tunnel-bypass-path.ts';

/**
 * Module logger for OpenSnitch system-firewall integration.
 */
const l = tagged({ tag: 'opensnitch', },);

/**
 * OpenSnitch release default system-firewall path.
 */
const DEFAULT_SYSTEM_FIREWALL_CONFIG = '/etc/opensnitchd/system-fw.json';

/**
 * Environment override for custom OpenSnitch daemon deployments and fixtures.
 */
export const OPENSNITCH_CONFIG_ENVIRONMENT = 'WG_QUICKER_OPENSNITCH_SYSTEM_FIREWALL_CONFIG';

/**
 * Delay between live-reload verification probes.
 */
const RELOAD_PROBE_INTERVAL_MS = 100;

/**
 * Bounded number of probes allowing OpenSnitch file watcher to rebuild nftables rules.
 */
const RELOAD_PROBE_ATTEMPTS = 40;

/**
 * Sentinel indicating OpenSnitch system-firewall file is absent.
 */
const OPENSNITCH_CONFIG_ABSENT: unique symbol = Symbol('OpenSnitch system-firewall config absent',);

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
function openSnitchConfigPath(): string {
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
function isOpenSnitchConfigAbsent(
  { value, }: { readonly value: string | typeof OPENSNITCH_CONFIG_ABSENT; },
): value is typeof OPENSNITCH_CONFIG_ABSENT {
  if ((typeof value) !== 'symbol')
    return false;
  return value === OPENSNITCH_CONFIG_ABSENT;
}

/**
 * Creates OpenSnitch-specific error for shared lock implementation.
 *
 * @param message - Lock failure diagnostic.
 *
 * @returns OpenSnitch configuration failure.
 *
 * @example
 * ```ts
 * makeOpenSnitchConfigError('busy');
 * ```
 */
function makeOpenSnitchConfigError(message: string,): OpenSnitchConfigError {
  return new OpenSnitchConfigError(message,);
}

/**
 * Acquires config-path lock serializing wg-quicker read-modify-write operations.
 *
 * @param path - OpenSnitch system-firewall config path.
 *
 * @returns Crash-safe advisory lock guard.
 *
 * @example
 * ```ts
 * await using lock = await claimOpenSnitchConfigOperation({ path: '/etc/opensnitchd/system-fw.json' });
 * ```
 */
async function claimOpenSnitchConfigOperation(
  { path, }: { readonly path: string; },
): Promise<AsyncDisposable> {
  await mkdir(
    bypassRuntimeDirectory(),
    {
      mode: 0o700,
      recursive: true,
    },
  );
  return await claimOperationLock({
    lockPath: `${bypassRuntimeDirectory()}/opensnitch-${bypassStateKey({ interfaceName: path, },)}.operation.lock`,
    conflictMessage: 'Another wg-quicker lifecycle is editing OpenSnitch system firewall.',
    errorFactory: makeOpenSnitchConfigError,
  },);
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
async function readOpenSnitchConfig(
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
    if (error instanceof OpenSnitchConfigError)
      throw error;
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
async function writeOpenSnitchConfig(
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

/**
 * Reports whether OpenSnitch nftables table currently exists.
 *
 * @returns True when daemon has installed its nftables table.
 *
 * @example
 * ```ts
 * await openSnitchTableExists();
 * ```
 */
async function openSnitchTableExists(): Promise<boolean> {
  /**
   * Nftables table probe whose failure means daemon is not currently active.
   */
  const result = await runAllowingFailure({
    command: 'nft',
    args: [
      'list',
      'table',
      'inet',
      'opensnitch',
    ],
  },);
  return result.exitCode === 0;
}

/**
 * Reports whether live output chain contains queue plus each managed port allowance.
 *
 * @param output - Numeric nft chain listing.
 *
 * @param ports - Required UDP destination ports.
 *
 * @returns Whether live reload reached usable state.
 *
 * @example
 * ```ts
 * isLiveRuleSetReady({ output: 'udp dport 51820 accept queue', ports: [51820] });
 * ```
 */
function isLiveRuleSetReady(
  {
    output,
    ports,
  }: {
    readonly output: string;
    readonly ports: readonly number[];
  },
): boolean {
  if (!output.includes('queue',))
    return false;
  return ports.every(function includesPort(port,): boolean {
    return output.includes(`udp dport ${String(port,)} accept`,);
  },);
}

/**
 * Waits for running OpenSnitch daemon to apply config through file watcher.
 *
 * Daemon absence skips verification because next daemon start reads persisted file.
 *
 * @param path - Config path used in failure diagnostic.
 *
 * @param ports - Managed endpoint ports expected in live chain.
 *
 * @throws {@link OpenSnitchConfigError} when running daemon does not converge.
 *
 * @example
 * ```ts
 * await verifyOpenSnitchLiveReload({ path, ports: [51820] });
 * ```
 */
async function verifyOpenSnitchLiveReload(
  {
    path,
    ports,
  }: {
    readonly path: string;
    readonly ports: readonly number[];
  },
): Promise<void> {
  if (!(await openSnitchTableExists()))
    return;
  /**
   * Mutable bounded cursor contained in object rather than function-root binding.
   */
  const cursor = { attempt: 0, };
  /* oxlint-disable eslint/no-await-in-loop -- Each probe depends on prior external state and delay. */
  while (cursor.attempt < RELOAD_PROBE_ATTEMPTS) {
    await wait(RELOAD_PROBE_INTERVAL_MS,);
    /**
     * Current numeric output-chain listing after one reload interval.
     */
    const result = await runAllowingFailure({
      command: 'nft',
      args: [
        '--numeric',
        'list',
        'chain',
        'inet',
        'opensnitch',
        'mangle_output',
      ],
    },);
    if ((result.exitCode === 0) && isLiveRuleSetReady({
      output: result.stdout,
      ports,
    },))
      return;
    cursor.attempt += 1;
  }
  /* oxlint-enable eslint/no-await-in-loop */
  throw new OpenSnitchConfigError(
    `OpenSnitch did not load wg-quicker endpoint rules from ${path}; its live nftables chain is incomplete.`,
  );
}

/**
 * Existing OpenSnitch config plus managed endpoint ports.
 */
type OpenSnitchReconcileResult = {
  /**
   * System-firewall config path changed or inspected.
   */
  readonly path: string;

  /**
   * Sorted managed endpoint ports after reconciliation.
   */
  readonly ports: readonly number[];
};

/**
 * Reconciles one interface's managed OpenSnitch rules under config lock.
 *
 * @param interfaceName - WireGuard interface owning rules.
 *
 * @param endpointPorts - Desired endpoint ports;
 * empty removes managed rules.
 *
 * @param requireEnabled - Whether disabled OpenSnitch system firewall rejects operation.
 *
 * @returns Existing config path and managed ports,
 * or absence sentinel when OpenSnitch is absent.
 *
 * @example
 * ```ts
 * await reconcileOpenSnitchEndpointAllowance({
 *   interfaceName: 'wg0',
 *   endpointPorts: [51820],
 *   requireEnabled: true,
 * });
 * ```
 */
async function reconcileOpenSnitchEndpointAllowance(
  {
    interfaceName,
    endpointPorts,
    requireEnabled,
  }: {
    readonly interfaceName: string;
    readonly endpointPorts: readonly number[];
    readonly requireEnabled: boolean;
  },
): Promise<OpenSnitchReconcileResult | typeof OPENSNITCH_CONFIG_ABSENT> {
  /**
   * Effective OpenSnitch config path.
   */
  const path = openSnitchConfigPath();
  /**
   * Unlocked existence probe avoiding runtime directory when OpenSnitch is absent.
   */
  const initial = await readOpenSnitchConfig({ path, },);
  if (isOpenSnitchConfigAbsent({ value: initial, },))
    return OPENSNITCH_CONFIG_ABSENT;
  /**
   * Config-path operation lock held through disk and live-kernel convergence.
   */
  await using lock = await claimOpenSnitchConfigOperation({ path, },);
  /**
   * Locked source re-read protecting against concurrent pre-lock changes.
   */
  const current = await readOpenSnitchConfig({ path, },);
  if (isOpenSnitchConfigAbsent({ value: current, },))
    return OPENSNITCH_CONFIG_ABSENT;
  /**
   * Validated unknown-field-preserving config tree.
   */
  const document = parseOpenSnitchConfig({
    text: current,
    path,
  },);
  /**
   * Immutable managed-rule reconciliation result.
   */
  const mutation = reconcileOpenSnitchConfig({
    document,
    interfaceName,
    endpointPorts,
    path,
    requireEnabled,
  },);
  if (mutation.changed) {
    await writeOpenSnitchConfig({
      path,
      original: current,
      rendered: renderOpenSnitchConfig({ document: mutation.document, },),
    },);
    await verifyOpenSnitchLiveReload({
      path,
      ports: mutation.managedPorts,
    },);
  }
  return {
    path,
    ports: mutation.managedPorts,
  };
}

/**
 * Adds visible OpenSnitch accept rules for WireGuard endpoint UDP ports.
 *
 * Any process can use accepted destination port while interface is up;
 * warning makes policy widening explicit.
 *
 * @param interfaceName - WireGuard interface owning rules.
 *
 * @param endpointPorts - Distinct peer endpoint UDP ports.
 *
 * @example
 * ```ts
 * await installOpenSnitchEndpointAllowance({ interfaceName: 'wg0', endpointPorts: [51820] });
 * ```
 */
export async function installOpenSnitchEndpointAllowance(
  {
    interfaceName,
    endpointPorts,
  }: {
    readonly interfaceName: string;
    readonly endpointPorts: readonly number[];
  },
): Promise<void> {
  /**
   * Reconciled OpenSnitch state or installation-absence sentinel.
   */
  const result = await reconcileOpenSnitchEndpointAllowance({
    interfaceName,
    endpointPorts,
    requireEnabled: true,
  },);
  if ((typeof result) === 'symbol') {
    if (result === OPENSNITCH_CONFIG_ABSENT)
      return;
    throw new OpenSnitchConfigError('Unexpected OpenSnitch reconciliation result.',);
  }
  /**
   * Concrete managed ports and config path after symbol narrowing.
   */
  const {
    path,
    ports,
  } = result;
  if (ports.length === 0)
    return;
  /**
   * Human-readable accepted port list.
   */
  const renderedPorts = ports.join(', ',);
  l.warn(
    `OpenSnitch now accepts any process's outbound UDP to destination port(s) ${renderedPorts} `
    + `before application filtering while ${interfaceName} is up. wg-quicker added visible rules to ${path} `
    + 'and removes them on down.',
  );
}

/**
 * Removes one interface's managed OpenSnitch rules during teardown.
 *
 * Removal is best-effort so malformed external config cannot strand tunnel routes or link.
 * Every failure is logged because stale rules widen firewall policy.
 *
 * @param interfaceName - WireGuard interface whose rules are removed.
 *
 * @example
 * ```ts
 * await removeOpenSnitchEndpointAllowance({ interfaceName: 'wg0' });
 * ```
 */
export async function removeOpenSnitchEndpointAllowance(
  { interfaceName, }: { readonly interfaceName: string; },
): Promise<void> {
  try {
    await reconcileOpenSnitchEndpointAllowance({
      interfaceName,
      endpointPorts: [],
      requireEnabled: false,
    },);
  }
  catch (error) {
    l.error(
      `Cannot remove ${interfaceName} OpenSnitch endpoint rules; `
      + `remove wg-quicker-managed rules manually: ${String(error,)}`,
    );
  }
}
