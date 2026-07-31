import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { BypassRouteError, } from './errors.ts';
import {
  run,
  runAllowingFailure,
} from './runner.ts';
import {
  BYPASS_STATE_ABSENT,
  claimBypassState,
  persistBypassState,
  readBypassState,
  releaseBypassState,
} from './tunnel-bypass-state.ts';
import {
  readPhysicalDefaults,
  removeOwnedBypassRoutes,
  synchronizeBypassRoutes,
} from './tunnel-bypass-route.ts';
import {
  BYPASS_PROTOS,
  BYPASS_ROUTE_PROTOCOL,
  type BypassState,
} from './tunnel-bypass-types.ts';
import {
  startBypassWatcher,
  stopBypassWatcher,
} from './tunnel-bypass-watch-service.ts';

/**
 * Module logger for bypass ownership lifecycle.
 */
const l = tagged({ tag: 'tunnel-bypass', },);

/**
 * Adds exact owned mark rule for each address family.
 *
 * @param state - Persisted mark,
 * table,
 * preference,
 * and protocol ownership.
 *
 * @example
 * ```ts
 * await addBypassRules({ state });
 * ```
 */
async function addBypassRules(
  { state, }: { readonly state: BypassState; },
): Promise<void> {
  /**
   * Primitive rule fields copied from caller state.
   */
  const {
    mark,
    table,
    preference,
  } = state;
  await Promise.all(BYPASS_PROTOS.map(function addRule(proto,): Promise<unknown> {
    return run({
      command: 'ip',
      args: [
        proto,
        'rule',
        'add',
        'fwmark',
        String(mark,),
        'table',
        String(table,),
        'pref',
        String(preference,),
        'protocol',
        String(BYPASS_ROUTE_PROTOCOL,),
      ],
    },);
  },),);
}

/**
 * Removes exact owned mark rules idempotently.
 *
 * @param state - Persisted rule identity.
 *
 * @example
 * ```ts
 * await removeBypassRules({ state });
 * ```
 */
async function removeBypassRules(
  { state, }: { readonly state: BypassState; },
): Promise<void> {
  /**
   * Primitive rule fields copied from caller state.
   */
  const {
    mark,
    table,
    preference,
  } = state;
  await Promise.all(BYPASS_PROTOS.map(function removeRule(proto,): Promise<unknown> {
    return runAllowingFailure({
      command: 'ip',
      args: [
        proto,
        'rule',
        'delete',
        'fwmark',
        String(mark,),
        'table',
        String(table,),
        'pref',
        String(preference,),
        'protocol',
        String(BYPASS_ROUTE_PROTOCOL,),
      ],
    },);
  },),);
}

/**
 * Removes watcher,
 * exact rules,
 * protocol-tagged defaults,
 * state,
 * and cooperative locks.
 *
 * @param state - Persisted ownership state.
 *
 * @example
 * ```ts
 * await cleanupBypassState({ state });
 * ```
 */
async function cleanupBypassState(
  { state, }: { readonly state: BypassState; },
): Promise<void> {
  await stopBypassWatcher({ state, },);
  await removeBypassRules({ state, },);
  await removeOwnedBypassRoutes({ state, },);
  await releaseBypassState({ state, },);
}

/**
 * Installs collision-safe policy route for exempt-marked traffic.
 *
 * Physical defaults are copied into dynamically claimed table.
 * Missing family gets unreachable default,
 * preventing marked traffic from falling through to VPN policy.
 * Supervised watcher resynchronizes after DHCP,
 * router advertisement,
 * and roaming changes.
 *
 * @param interfaceName - Tunnel interface owning bypass state.
 *
 * @param mark - Socket mark identifying exempt traffic.
 *
 * @param watchRouteChanges - Whether to start systemd watcher.
 * Disposable netns tests may run watcher directly in namespace.
 *
 * @example
 * ```ts
 * await addExemptRule({ interfaceName: 'wg0', mark: 8888, watchRouteChanges: true });
 * ```
 */
export async function addExemptRule(
  {
    interfaceName,
    mark,
    watchRouteChanges,
  }: {
    readonly interfaceName: string;
    readonly mark: number;
    readonly watchRouteChanges: boolean;
  },
): Promise<void> {
  /**
   * Function-scoped logger for setup lifecycle.
   */
  const fl = tagged({
    tag: addExemptRule.name,
    l,
  },);
  /**
   * Existing state from interrupted prior lifecycle.
   */
  const existing = await readBypassState({ interfaceName, },);
  if (existing !== BYPASS_STATE_ABSENT) {
    fl.warn(`cleaning stale bypass state for ${interfaceName}`,);
    await cleanupBypassState({ state: existing, },);
  }
  /**
   * Physical defaults required before claiming resources.
   */
  const physical = await readPhysicalDefaults();
  if (physical.length === 0) {
    throw new BypassRouteError(
      `Cannot exempt applications for ${interfaceName}: no IPv4 or IPv6 physical default route exists.`,
    );
  }
  /**
   * Collision-safe resources persisted before route mutation.
   */
  const state = await claimBypassState({
    interfaceName,
    mark,
  },);
  await persistBypassState({ state, },);
  try {
    /**
     * Physical defaults observed during initial synchronization.
     */
    const synchronized = await synchronizeBypassRoutes({ state, },);
    if (synchronized === 0) {
      throw new BypassRouteError(
        `Physical defaults disappeared while configuring ${interfaceName}.`,
      );
    }
    await addBypassRules({ state, },);
    if (watchRouteChanges)
      await startBypassWatcher({ state, },);
    fl.debug(
      `installed mark ${String(mark,)} table ${String(state.table,)} preference ${String(state.preference,)}`,
    );
  }
  catch (error) {
    fl.error(`failed to install bypass state for ${interfaceName}: ${String(error,)}`,);
    await cleanupBypassState({ state, },);
    throw error;
  }
}

/**
 * Removes persisted application-bypass state for interface.
 *
 * Teardown discovers mark,
 * table,
 * and preference from root-owned state rather than current config values.
 * Absence is idempotent.
 *
 * @param interfaceName - Tunnel interface whose state is removed.
 *
 * @example
 * ```ts
 * await removeExemptRule({ interfaceName: 'wg0' });
 * ```
 */
export async function removeExemptRule(
  { interfaceName, }: { readonly interfaceName: string; },
): Promise<void> {
  /**
   * Persisted state when bypass setup completed or partially completed.
   */
  const state = await readBypassState({ interfaceName, },);
  if (state === BYPASS_STATE_ABSENT) {
    l.debug(`no bypass state for ${interfaceName}`,);
    return;
  }
  await cleanupBypassState({ state, },);
  l.debug(`removed bypass state for ${interfaceName}`,);
}
