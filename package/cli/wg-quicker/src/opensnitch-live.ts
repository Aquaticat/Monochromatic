import { wait, } from '@monochromatic-dev/module-async-time/ts';

import { OpenSnitchConfigError, } from './errors.ts';
import { runAllowingFailure, } from './runner.ts';

/**
 * Delay between live-reload verification probes.
 */
const RELOAD_PROBE_INTERVAL_MS = 100;

/**
 * Bounded number of probes allowing OpenSnitch file watcher to rebuild nftables rules.
 */
const RELOAD_PROBE_ATTEMPTS = 40;

/**
 * Consecutive healthy observations required after file watcher reload.
 */
const RELOAD_STABLE_PROBES = 3;

/**
 * Reports whether OpenSnitch daemon is active in current process namespace.
 *
 * Exit status one from `pgrep` proves process absence;
 * other failures are operational errors rather than absence.
 *
 * @returns Whether exact daemon process name is active.
 *
 * @throws {@link OpenSnitchConfigError} when process probe itself fails.
 *
 * @example
 * ```ts
 * await isOpenSnitchDaemonActive();
 * ```
 */
async function isOpenSnitchDaemonActive(): Promise<boolean> {
  /**
   * Exact process-name probe without output.
   */
  const result = await runAllowingFailure({
    command: 'pgrep',
    args: [
      '--exact',
      '--quiet',
      'opensnitchd',
    ],
  },);
  if (result.exitCode === 0)
    return true;
  if (result.exitCode === 1)
    return false;
  throw new OpenSnitchConfigError(
    `Cannot determine whether OpenSnitch daemon is active: ${result.stderr}`,
  );
}

/**
 * Reports whether live output chain contains correctly ordered allowances.
 *
 * @param output - Numeric nft chain listing.
 *
 * @param requiredPorts - UDP destination ports that must precede NFQUEUE.
 *
 * @param forbiddenPorts - Formerly owned ports that must be absent.
 *
 * @returns Whether live reload reached usable strict-deny state.
 *
 * @example
 * ```ts
 * isLiveRuleSetReady({
 *   output: 'udp dport 51820 accept\nqueue',
 *   requiredPorts: [51820],
 *   forbiddenPorts: [],
 * });
 * ```
 */
export function isLiveRuleSetReady(
  {
    output,
    requiredPorts,
    forbiddenPorts,
  }: {
    readonly output: string;
    readonly requiredPorts: readonly number[];
    readonly forbiddenPorts: readonly number[];
  },
): boolean {
  /**
   * First application-filter queue position establishing ordering boundary.
   */
  const queueIndex = output.indexOf('queue',);
  if (queueIndex === (-1))
    return false;
  /**
   * Resolves exact generated accept-rule position.
   *
   * @param port - Exact UDP destination port.
   *
   * @returns Character offset or negative absence sentinel.
   */
  function portIndex(port: number,): number {
    return output.indexOf(`udp dport ${String(port,)} accept`,);
  }
  if (!requiredPorts.every(function precedesQueue(port,): boolean {
    /**
     * Exact generated rule offset.
     */
    const index = portIndex(port,);
    return (index >= 0) && (index < queueIndex);
  },))
    return false;
  return forbiddenPorts.every(function excludesPort(port,): boolean {
    return portIndex(port,) < 0;
  },);
}

/**
 * Waits for active OpenSnitch daemon to apply config through file watcher.
 *
 * Confirmed daemon absence skips verification because next daemon start reads persisted file.
 *
 * @param path - Config path used in failure diagnostic.
 *
 * @param requiredPorts - Managed endpoint ports expected before live NFQUEUE rules.
 *
 * @param forbiddenPorts - Removed exact ports expected absent from live chain.
 *
 * @throws {@link OpenSnitchConfigError} when active daemon does not converge.
 *
 * @example
 * ```ts
 * await verifyOpenSnitchLiveReload({
 *   path,
 *   requiredPorts: [51820],
 *   forbiddenPorts: [],
 * });
 * ```
 */
export async function verifyOpenSnitchLiveReload(
  {
    path,
    requiredPorts,
    forbiddenPorts,
  }: {
    readonly path: string;
    readonly requiredPorts: readonly number[];
    readonly forbiddenPorts: readonly number[];
  },
): Promise<void> {
  if (!(await isOpenSnitchDaemonActive()))
    return;
  /**
   * Mutable bounded cursor contained in object rather than function-root binding.
   */
  const cursor = {
    attempt: 0,
    consecutiveReady: 0,
  };
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
      requiredPorts,
      forbiddenPorts,
    },))
      cursor.consecutiveReady += 1;
    else
      cursor.consecutiveReady = 0;
    if (cursor.consecutiveReady >= RELOAD_STABLE_PROBES)
      return;
    cursor.attempt += 1;
  }
  /* oxlint-enable eslint/no-await-in-loop */
  throw new OpenSnitchConfigError(
    `OpenSnitch did not converge after reading ${path}; its live nftables chain has missing, stale, or misordered rules.`,
  );
}
