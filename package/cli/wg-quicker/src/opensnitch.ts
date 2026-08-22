import { mkdir, } from 'node:fs/promises';

import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { OpenSnitchConfigError, } from './errors.ts';
import { claimOperationLock, } from './operation-lock.ts';
import {
  isOpenSnitchConfigAbsent,
  OPENSNITCH_CONFIG_ABSENT,
  readOpenSnitchConfig,
  writeOpenSnitchConfig,
} from './opensnitch-config-file.ts';
import {
  OPENSNITCH_DAEMON_CONFIG_ABSENT,
  resolveOpenSnitchSystemFirewallPath,
} from './opensnitch-daemon-config.ts';
import {
  type OpenSnitchConfigMutation,
  parseOpenSnitchConfig,
  reconcileOpenSnitchConfig,
  renderOpenSnitchConfig,
} from './opensnitch-config-tree.ts';
import { verifyOpenSnitchLiveReload, } from './opensnitch-live.ts';
import {
  OPENSNITCH_STATE_ABSENT,
  readOpenSnitchState,
  removeOpenSnitchState,
  type OpenSnitchState,
  writeOpenSnitchState,
} from './opensnitch-state.ts';
import {
  bypassRuntimeDirectory,
  bypassStateKey,
} from './tunnel-bypass-path.ts';

export {
  OPENSNITCH_CONFIG_ENVIRONMENT,
  OPENSNITCH_DAEMON_CONFIG_ENVIRONMENT,
} from './opensnitch-daemon-config.ts';

/**
 * Module logger for OpenSnitch system-firewall integration.
 */
const l = tagged({ tag: 'opensnitch', },);

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
 * Ensures private runtime directory exists.
 *
 * @example
 * ```ts
 * await ensureOpenSnitchRuntimeDirectory();
 * ```
 */
async function ensureOpenSnitchRuntimeDirectory(): Promise<void> {
  await mkdir(
    bypassRuntimeDirectory(),
    {
      mode: 0o700,
      recursive: true,
    },
  );
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
  await ensureOpenSnitchRuntimeDirectory();
  return await claimOperationLock({
    lockPath: `${bypassRuntimeDirectory()}/opensnitch-${bypassStateKey({ interfaceName: path, },)}.operation.lock`,
    conflictMessage: 'Another wg-quicker lifecycle is editing OpenSnitch system firewall.',
    errorFactory: makeOpenSnitchConfigError,
  },);
}

/**
 * Acquires interface lock covering lifecycle manifest and config transition.
 *
 * @param interfaceName - WireGuard interface identity.
 *
 * @returns Crash-safe advisory lock guard.
 *
 * @example
 * ```ts
 * await using lock = await claimOpenSnitchInterfaceOperation({ interfaceName: 'wg0' });
 * ```
 */
async function claimOpenSnitchInterfaceOperation(
  { interfaceName, }: { readonly interfaceName: string; },
): Promise<AsyncDisposable> {
  await ensureOpenSnitchRuntimeDirectory();
  return await claimOperationLock({
    lockPath: `${bypassRuntimeDirectory()}/opensnitch-interface-${bypassStateKey({ interfaceName, },)}.operation.lock`,
    conflictMessage: `Another wg-quicker lifecycle is changing ${interfaceName} OpenSnitch rules.`,
    errorFactory: makeOpenSnitchConfigError,
  },);
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
 * Resolves effective config path while mapping daemon absence to integration sentinel.
 *
 * @param requireNftables - Whether startup requires validated nftables backend.
 *
 * @returns Absolute system-firewall path or absence sentinel.
 *
 * @example
 * ```ts
 * await resolveOpenSnitchPath({ requireNftables: true });
 * ```
 */
async function resolveOpenSnitchPath(
  { requireNftables, }: { readonly requireNftables: boolean; },
): Promise<string | typeof OPENSNITCH_CONFIG_ABSENT> {
  /**
   * Daemon-derived path or daemon-absence sentinel.
   */
  const resolved = await resolveOpenSnitchSystemFirewallPath({ requireNftables, },);
  if ((typeof resolved) !== 'symbol')
    return resolved;
  if (resolved === OPENSNITCH_DAEMON_CONFIG_ABSENT)
    return OPENSNITCH_CONFIG_ABSENT;
  throw new OpenSnitchConfigError('Unexpected OpenSnitch system-firewall path result.',);
}

/**
 * Inspects config before lifecycle ownership is persisted.
 *
 * @param path - Concrete system-firewall path.
 *
 * @param interfaceName - WireGuard interface owning rules.
 *
 * @param endpointPorts - Desired endpoint ports.
 *
 * @returns Dry reconciliation metadata or absence sentinel.
 *
 * @example
 * ```ts
 * await inspectOpenSnitchConfig({ path, interfaceName: 'wg0', endpointPorts: [51820] });
 * ```
 */
async function inspectOpenSnitchConfig(
  {
    path,
    interfaceName,
    endpointPorts,
  }: {
    readonly path: string;
    readonly interfaceName: string;
    readonly endpointPorts: readonly number[];
  },
): Promise<OpenSnitchConfigMutation | typeof OPENSNITCH_CONFIG_ABSENT> {
  /**
   * Current safe config source.
   */
  const source = await readOpenSnitchConfig({ path, },);
  if (isOpenSnitchConfigAbsent(source,))
    return OPENSNITCH_CONFIG_ABSENT;
  return reconcileOpenSnitchConfig({
    document: parseOpenSnitchConfig({
      text: source,
      path,
    },),
    interfaceName,
    endpointPorts,
    path,
    requireEnabled: true,
  },);
}

/**
 * Reconciles one interface's managed rules under config-path lock.
 *
 * @param path - Concrete system-firewall path.
 *
 * @param interfaceName - WireGuard interface owning rules.
 *
 * @param endpointPorts - Desired endpoint ports; empty removes rules.
 *
 * @param previousManagedPorts - Persisted ports requiring crash-recovery verification.
 *
 * @param requireEnabled - Whether disabled system firewall rejects operation.
 *
 * @param verifyLive - Whether unchanged config still requires kernel verification.
 *
 * @returns Existing config path and managed ports or file-absence sentinel.
 *
 * @example
 * ```ts
 * await reconcileOpenSnitchEndpointAllowance({
 *   path,
 *   interfaceName: 'wg0',
 *   endpointPorts: [51820],
 *   previousManagedPorts: [],
 *   requireEnabled: true,
 *   verifyLive: true,
 * });
 * ```
 */
async function reconcileOpenSnitchEndpointAllowance(
  {
    path,
    interfaceName,
    endpointPorts,
    previousManagedPorts,
    requireEnabled,
    verifyLive,
  }: {
    readonly path: string;
    readonly interfaceName: string;
    readonly endpointPorts: readonly number[];
    readonly previousManagedPorts: readonly number[];
    readonly requireEnabled: boolean;
    readonly verifyLive: boolean;
  },
): Promise<OpenSnitchReconcileResult | typeof OPENSNITCH_CONFIG_ABSENT> {
  /**
   * Unlocked existence probe avoiding runtime config lock when file is absent.
   */
  const initial = await readOpenSnitchConfig({ path, },);
  if (isOpenSnitchConfigAbsent(initial,))
    return OPENSNITCH_CONFIG_ABSENT;
  /**
   * Config-path operation lock held through disk and live-kernel convergence.
   */
  await using lock = await claimOpenSnitchConfigOperation({ path, },);
  /**
   * Locked source re-read protecting against concurrent pre-lock changes.
   */
  const current = await readOpenSnitchConfig({ path, },);
  if (isOpenSnitchConfigAbsent(current,))
    return OPENSNITCH_CONFIG_ABSENT;
  /**
   * Immutable managed-rule reconciliation result.
   */
  const mutation = reconcileOpenSnitchConfig({
    document: parseOpenSnitchConfig({
      text: current,
      path,
    },),
    interfaceName,
    endpointPorts,
    path,
    requireEnabled,
    previousManagedPorts,
  },);
  if (mutation.changed) {
    await writeOpenSnitchConfig({
      path,
      original: current,
      rendered: renderOpenSnitchConfig({ document: mutation.document, },),
    },);
  }
  if (verifyLive || mutation.changed) {
    await verifyOpenSnitchLiveReload({
      path,
      requiredPorts: mutation.managedPorts,
      forbiddenPorts: mutation.forbiddenPorts,
    },);
  }
  return {
    path,
    ports: mutation.managedPorts,
  };
}

/**
 * Produces sorted distinct port union for transitional crash recovery.
 *
 * @param groups - Port groups whose ownership must remain recoverable.
 *
 * @returns Sorted distinct ports.
 *
 * @example
 * ```ts
 * mergePorts({ groups: [[51820], [2049]] });
 * ```
 */
function mergePorts(
  { groups, }: { readonly groups: readonly (readonly number[])[]; },
): readonly number[] {
  return [...new Set(groups.flat(),),]
    .toSorted(function ascending(
      a,
      b,
    ): number {
      return a - b;
    },);
}

/**
 * Removes rules described by persisted lifecycle state and clears state after proof.
 *
 * @param interfaceName - WireGuard interface identity.
 *
 * @param state - Persisted config path and potential ports.
 *
 * @throws {@link OpenSnitchConfigError} when config disappeared before cleanup proof.
 *
 * @example
 * ```ts
 * await removePersistedOpenSnitchAllowance({ interfaceName: 'wg0', state });
 * ```
 */
async function removePersistedOpenSnitchAllowance(
  {
    interfaceName,
    state,
  }: {
    readonly interfaceName: string;
    readonly state: OpenSnitchState;
  },
): Promise<void> {
  /**
   * Removal result proving config was available for reconciliation.
   */
  const result = await reconcileOpenSnitchEndpointAllowance({
    path: state.path,
    interfaceName,
    endpointPorts: [],
    previousManagedPorts: state.ports,
    requireEnabled: false,
    verifyLive: true,
  },);
  if ((typeof result) === 'symbol') {
    if (result === OPENSNITCH_CONFIG_ABSENT) {
      throw new OpenSnitchConfigError(
        `Cannot confirm removal because managed OpenSnitch config is absent: ${state.path}`,
      );
    }
    throw new OpenSnitchConfigError('Unexpected OpenSnitch removal result.',);
  }
  await removeOpenSnitchState({ interfaceName, },);
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
  await using interfaceOperation = await claimOpenSnitchInterfaceOperation({ interfaceName, },);
  /**
   * Prior lifecycle state surviving normal operation or interrupted transition.
   */
  const previous = await readOpenSnitchState({ interfaceName, },);
  /**
   * Effective validated startup path or daemon-absence sentinel.
   */
  const resolvedPath = await resolveOpenSnitchPath({ requireNftables: true, },);
  if ((typeof resolvedPath) === 'symbol') {
    if (resolvedPath !== OPENSNITCH_CONFIG_ABSENT)
      throw new OpenSnitchConfigError('Unexpected OpenSnitch installation path result.',);
    if ((typeof previous) !== 'symbol')
      await removePersistedOpenSnitchAllowance({ interfaceName, state: previous, },);
    return;
  }
  if (((typeof previous) !== 'symbol') && (previous.path !== resolvedPath))
    await removePersistedOpenSnitchAllowance({ interfaceName, state: previous, },);
  /**
   * State remaining on same path after stale-path cleanup.
   */
  const samePathState = ((typeof previous) !== 'symbol') && (previous.path === resolvedPath)
    ? previous
    : OPENSNITCH_STATE_ABSENT;
  /**
   * Dry schema check before claiming external cleanup ownership.
   */
  const inspection = await inspectOpenSnitchConfig({
    path: resolvedPath,
    interfaceName,
    endpointPorts,
  },);
  if ((typeof inspection) === 'symbol') {
    if (inspection !== OPENSNITCH_CONFIG_ABSENT)
      throw new OpenSnitchConfigError('Unexpected OpenSnitch inspection result.',);
    if ((typeof samePathState) !== 'symbol') {
      throw new OpenSnitchConfigError(
        `Cannot update persisted OpenSnitch rules because config is absent: ${resolvedPath}`,
      );
    }
    return;
  }
  /**
   * Transitional ownership includes every port a crash could leave behind.
   */
  const transitionPorts = mergePorts({
    groups: [
      inspection.managedPorts,
      inspection.forbiddenPorts,
      (typeof samePathState) === 'symbol' ? [] : samePathState.ports,
    ],
  },);
  await writeOpenSnitchState({
    interfaceName,
    state: {
      path: resolvedPath,
      ports: transitionPorts,
    },
  },);
  /**
   * Reconciled and positively verified OpenSnitch state.
   */
  const result = await reconcileOpenSnitchEndpointAllowance({
    path: resolvedPath,
    interfaceName,
    endpointPorts,
    previousManagedPorts: transitionPorts,
    requireEnabled: true,
    verifyLive: true,
  },);
  if ((typeof result) === 'symbol') {
    throw new OpenSnitchConfigError(
      `OpenSnitch config disappeared during installation: ${resolvedPath}`,
    );
  }
  if (result.ports.length === 0) {
    await removeOpenSnitchState({ interfaceName, },);
    return;
  }
  await writeOpenSnitchState({
    interfaceName,
    state: {
      path: result.path,
      ports: result.ports,
    },
  },);
  /**
   * Human-readable accepted port list.
   */
  const renderedPorts = result.ports.join(', ',);
  l.warn(
    `OpenSnitch now accepts any process's outbound UDP to destination port(s) ${renderedPorts} `
    + `before application filtering while ${interfaceName} is up. wg-quicker added visible rules to ${result.path} `
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
    await using interfaceOperation = await claimOpenSnitchInterfaceOperation({ interfaceName, },);
    /**
     * Persisted exact cleanup target when installation reached ownership transition.
     */
    const persisted = await readOpenSnitchState({ interfaceName, },);
    if ((typeof persisted) !== 'symbol') {
      await removePersistedOpenSnitchAllowance({ interfaceName, state: persisted, },);
      return;
    }
    if (persisted !== OPENSNITCH_STATE_ABSENT)
      throw new OpenSnitchConfigError('Unexpected OpenSnitch lifecycle-state result.',);
    /**
     * Fallback path supports managed rules created before lifecycle manifests existed.
     */
    const path = await resolveOpenSnitchPath({ requireNftables: false, },);
    if ((typeof path) === 'symbol') {
      if (path === OPENSNITCH_CONFIG_ABSENT)
        return;
      throw new OpenSnitchConfigError('Unexpected OpenSnitch fallback removal path result.',);
    }
    await reconcileOpenSnitchEndpointAllowance({
      path,
      interfaceName,
      endpointPorts: [],
      previousManagedPorts: [],
      requireEnabled: false,
      verifyLive: false,
    },);
  }
  catch (error) {
    l.error(
      `Cannot remove ${interfaceName} OpenSnitch endpoint rules; `
      + `remove wg-quicker-managed rules manually: ${String(error,)}`,
    );
  }
}
