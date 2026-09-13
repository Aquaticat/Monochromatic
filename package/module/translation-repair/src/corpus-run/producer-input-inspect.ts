import { isDeepStrictEqual, } from 'node:util';
import { producerInputBindings, } from './producer-input-bindings.ts';
import { PRODUCER_INPUT_CHILD_SENTINEL, PRODUCER_INPUT_LIMITS, } from './producer-input-container.ts';
import { producerInputChildEnvironment, PRODUCER_INPUT_HOSTNAME, } from './producer-input-environment.ts';
import { ProducerInputRunError, } from './producer-input-error.ts';
import type { ProducerInputHost, } from './producer-input-host-init.ts';
import { PRODUCER_INPUT_PATHS, } from './producer-input-paths.ts';

//region Native created-container evidence before Node startup

/** Native user-namespace mapping rows contain origin, destination and extent. */
const MAPPING_FIELDS = 3;
/** Default capabilities removed by the pinned Podman implementation's ALL request. */
const REMOVED_CAPABILITIES = ['CAP_CHOWN', 'CAP_DAC_OVERRIDE', 'CAP_FOWNER', 'CAP_FSETID', 'CAP_KILL', 'CAP_NET_BIND_SERVICE', 'CAP_SETFCAP', 'CAP_SETGID', 'CAP_SETPCAP', 'CAP_SETUID', 'CAP_SYS_CHROOT'] as const;

/**
 * Narrows native JSON objects without accepting arrays as maps.
 *
 * @param value - decoded native metadata
 *
 * @returns Whether named fields can be inspected
 *
 * @example
 * ```ts
 * if (record(value)) inspect(value.Id);
 * ```
 */
function record(value: unknown): value is Readonly<Record<string, unknown>> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Reads exactly one native inspection object with fixed diagnostics.
 *
 * @param text - bounded native stdout
 *
 * @returns Owned decoded inspection record
 *
 * @throws ProducerInputRunError when native metadata does not have the expected envelope
 *
 * @example
 * ```ts
 * const inspection = inspectionRecord(text);
 * ```
 */
function inspectionRecord(text: string): Readonly<Record<string, unknown>> {
  try {
    /** Native JSON is data, never a script or configuration import. */
    const decoded: unknown = JSON.parse(text);
    if (!Array.isArray(decoded))
      throw new ProducerInputRunError({ operation: 'launch-container', locator: 'container inspection envelope', });
    /** Keep untrusted row types unknown after the native array check. */
    const rows: readonly unknown[] = decoded;
    /** No extra inspection result can silently change the selected container. */
    const [value] = rows;
    if (rows.length !== 1 || !record(value))
      throw new ProducerInputRunError({ operation: 'launch-container', locator: 'container inspection envelope', });
    return value;
  }
  catch (error) {
    if (error instanceof ProducerInputRunError)
      throw error;
    throw new ProducerInputRunError({ operation: 'launch-container', locator: 'container inspection JSON', });
  }
}

/**
 * Checks one named metadata field without printing its supplied value.
 *
 * @param fields - native metadata object
 *
 * @param name - fixed field label
 *
 * @param expected - value independently derived from the initialized host
 *
 * @throws ProducerInputRunError when a binding differs
 *
 * @example
 * ```ts
 * fieldMatches({ fields, name: 'Image', expected: host.launch.imageId });
 * ```
 */
function fieldMatches({ fields, name, expected, }: { readonly fields: Readonly<Record<string, unknown>>; readonly name: string; readonly expected: unknown; },): void {
  if (!isDeepStrictEqual(fields[name], expected))
    throw new ProducerInputRunError({ operation: 'launch-container', locator: `container field ${name}`, });
}

/**
 * Reads a complete string-list field before treating its ordering as irrelevant.
 *
 * @param value - native field value
 *
 * @param name - fixed field label
 *
 * @returns Detached string values in lexical order
 *
 * @throws ProducerInputRunError when list shape differs
 *
 * @example
 * ```ts
 * const values = strings({ value, name: 'Env' });
 * ```
 */
function strings({ value, name, }: { readonly value: unknown; readonly name: string; },): readonly string[] {
  if (!Array.isArray(value))
    throw new ProducerInputRunError({ operation: 'launch-container', locator: `container field ${name}`, });
  /** Values remain unknown until checked, including holes and unexpected element types. */
  const rows: readonly unknown[] = value;
  return rows.map(function text(item): string {
    if (typeof item !== 'string')
      throw new ProducerInputRunError({ operation: 'launch-container', locator: `container field ${name}`, });
    return item;
  }).toSorted();
}

/**
 * Checks the pinned rootless mapping's caller row without treating its intermediate namespace IDs as host UIDs.
 *
 * @param value - native UID or GID mapping rows
 *
 * @param caller - independently captured caller ID
 *
 * @param name - fixed mapping field label
 *
 * @throws ProducerInputRunError when the caller is not mapped uniquely to the rootless namespace owner
 *
 * @example
 * ```ts
 * callerMapping({ value, caller: host.run.uid, name: 'UidMap' });
 * ```
 */
function callerMapping({ value, caller, name, }: { readonly value: unknown; readonly caller: number; readonly name: string; },): void {
  /** Native metadata uses container:intermediate-namespace:extent rows in this measured profile. */
  const rows = strings({ value, name });
  /** The rootless owner maps only this caller coordinate, not a whole user range, to namespace zero. */
  const wanted = `${caller}:0:1`;
  if (rows.filter(function owner(row): boolean { return row === wanted; }).length !== 1)
    throw new ProducerInputRunError({ operation: 'launch-container', locator: `container mapping ${name}`, });
  for (const row of rows) {
    /** Every other range must exclude both the caller coordinate and namespace owner zero. */
    const parts = row.split(':');
    /** Native range fields are kept separate from filesystem or caller authorization. */
    const [containerText, namespaceText, extentText] = parts;
    /** Exact numeric conversion refuses rounding and alternate spellings. */
    const container = Number(containerText);
    /** This coordinate is not asserted to be a host-account UID. */
    const namespace = Number(namespaceText);
    /** Extent is validated before it is used for membership. */
    const extent = Number(extentText);
    if (parts.length !== MAPPING_FIELDS || !Number.isSafeInteger(container) || container < 0 || String(container) !== containerText
      || !Number.isSafeInteger(namespace) || namespace < 0 || String(namespace) !== namespaceText
      || !Number.isSafeInteger(extent) || extent <= 0 || String(extent) !== extentText || !Number.isSafeInteger(container + extent)
      || row !== wanted && (namespace === 0 || container <= caller && caller < container + extent))
      throw new ProducerInputRunError({ operation: 'launch-container', locator: `container mapping ${name}`, });
  }
}

/**
 * Verifies every requested bind and rejects all unregistered mounts in the native creation metadata.
 *
 * @param host - initialized host binding owner
 *
 * @param value - native Mounts field
 *
 * @throws ProducerInputRunError when a mount differs or an extra mount appears
 *
 * @example
 * ```ts
 * verifyCreatedBindings({ host, value: inspection.Mounts });
 * ```
 */
function verifyCreatedBindings({ host, value, }: { readonly host: ProducerInputHost; readonly value: unknown; },): void {
  if (!Array.isArray(value))
    throw new ProducerInputRunError({ operation: 'launch-container', locator: 'created bind mounts', });
  /** The fixed destination set is derived by the same owning boundary as argv construction. */
  const expected = producerInputBindings(host);
  /** JSON array elements gain no implicit record authority. */
  const rows: readonly unknown[] = value;
  if (rows.length !== expected.length)
    throw new ProducerInputRunError({ operation: 'launch-container', locator: 'created bind mount count', });
  for (const binding of expected) {
    /** Exactly one row must own each fixed child destination. */
    const matches = rows.filter(function destination(row): boolean {
      return record(row) && row.Destination === binding.target;
    });
    /** A duplicate destination is not resolved by native inspection order. */
    const [mount] = matches;
    if (matches.length !== 1 || !record(mount))
      throw new ProducerInputRunError({ operation: 'launch-container', locator: binding.target, });
    for (const [name, wanted] of Object.entries({ Type: 'bind', Source: binding.source, Destination: binding.target, Driver: '', Mode: '', Options: ['rbind'], RW: binding.writable, Propagation: 'rprivate' }))
      fieldMatches({ fields: mount, name, expected: wanted });
  }
}

/**
 * Cross-checks native creation metadata before starting the fixed Node process.
 * This is point-in-time host observation, not protection against a hostile host replacing the container afterward.
 *
 * @param host - one initialized host owner
 *
 * @param id - identity returned by this run's successful exclusive create operation
 *
 * @param text - bounded native inspection response
 *
 * @throws ProducerInputRunError when image, command, environment, resource or mount bindings differ
 *
 * @example
 * ```ts
 * verifyCreatedProducerInputContainer({ host, id, text });
 * ```
 */
export function verifyCreatedProducerInputContainer({ host, id, text, }: { readonly host: ProducerInputHost; readonly id: string; readonly text: string; },): void {
  /** No complete inspection object is logged before its environment and mounts are checked. */
  const inspection = inspectionRecord(text);
  for (const [name, expected] of Object.entries({ Id: id, Image: host.launch.imageId, Name: `producer-input-${host.run.runId}`, Path: PRODUCER_INPUT_PATHS.node, Args: [PRODUCER_INPUT_PATHS.bootstrap, PRODUCER_INPUT_CHILD_SENTINEL] }))
    fieldMatches({ fields: inspection, name, expected });
  /** These native records are checked before any nested field receives a typed interpretation. */
  const { Config: config, HostConfig: limits, State: state } = inspection;
  if (!record(config) || !record(limits) || !record(state))
    throw new ProducerInputRunError({ operation: 'launch-container', locator: 'created container records', });
  fieldMatches({ fields: state, name: 'Status', expected: 'created' });
  fieldMatches({ fields: state, name: 'Running', expected: false });
  for (const [name, expected] of Object.entries({ User: `${host.run.uid}:${host.run.gid}`, WorkingDir: PRODUCER_INPUT_PATHS.output, Hostname: PRODUCER_INPUT_HOSTNAME, Entrypoint: [PRODUCER_INPUT_PATHS.node], Cmd: [PRODUCER_INPUT_PATHS.bootstrap, PRODUCER_INPUT_CHILD_SENTINEL] }))
    fieldMatches({ fields: config, name, expected });
  fieldMatches({ fields: config, name: 'Timeout', expected: PRODUCER_INPUT_LIMITS.seconds });
  fieldMatches({ fields: config, name: 'Healthcheck', expected: { Test: ['NONE'] } });
  fieldMatches({ fields: config, name: 'HealthcheckOnFailureAction', expected: 'none' });
  fieldMatches({ fields: limits, name: 'UsernsMode', expected: 'private' });
  if (!record(limits.IDMappings))
    throw new ProducerInputRunError({ operation: 'launch-container', locator: 'created user namespace mappings', });
  callerMapping({ value: limits.IDMappings.UidMap, caller: host.run.uid, name: 'UidMap' });
  callerMapping({ value: limits.IDMappings.GidMap, caller: host.run.gid, name: 'GidMap' });
  /** Environment values are independently reconstructed, not accepted merely because names are familiar. */
  const environment = producerInputChildEnvironment({ runId: host.run.runId, launchSha256: host.launchIdentity.sha256, launchBytes: host.launchIdentity.bytes, callerUid: host.run.uid, callerGid: host.run.gid });
  if (!isDeepStrictEqual(strings({ value: config.Env, name: 'Env' }), Object.entries(environment).map(function entry([name, value]): string { return `${name}=${value}`; }).toSorted()))
    throw new ProducerInputRunError({ operation: 'launch-container', locator: 'created child environment', });
  for (const [name, expected] of Object.entries({ NetworkMode: 'none', Memory: PRODUCER_INPUT_LIMITS.memoryBytes, MemorySwap: PRODUCER_INPUT_LIMITS.memoryAndSwapBytes, CpuPeriod: PRODUCER_INPUT_LIMITS.cpuPeriod, CpuQuota: PRODUCER_INPUT_LIMITS.cpuQuota, PidsLimit: PRODUCER_INPUT_LIMITS.pids, ReadonlyRootfs: true, Privileged: false, AutoRemove: false, CapAdd: [] }))
    fieldMatches({ fields: limits, name, expected });
  if (!isDeepStrictEqual(strings({ value: limits.CapDrop, name: 'CapDrop' }), REMOVED_CAPABILITIES.toSorted())
    || !isDeepStrictEqual(strings({ value: limits.SecurityOpt, name: 'SecurityOpt' }), ['label=disable', 'no-new-privileges']))
    throw new ProducerInputRunError({ operation: 'launch-container', locator: 'created privilege configuration', });
  if (!record(limits.Tmpfs) || Object.keys(limits.Tmpfs).length !== 1 || typeof limits.Tmpfs['/tmp'] !== 'string'
    || !isDeepStrictEqual(limits.Tmpfs['/tmp'].split(',').toSorted(), ['rw', 'noexec', 'nosuid', 'nodev', `size=${PRODUCER_INPUT_LIMITS.temporaryBytes}`, 'rprivate', 'tmpcopyup'].toSorted()))
    throw new ProducerInputRunError({ operation: 'launch-container', locator: 'created temporary filesystem', });
  verifyCreatedBindings({ host, value: inspection.Mounts });
}

/** Current native state is not represented by fabricated optional exit fields. */
export type ProducerInputContainerState = { readonly state: 'created'; } | { readonly state: 'running'; } | {
  /** Native process lifecycle has ended. */
  readonly state: 'exited';
  /** Native exit status, including the runtime's negative termination sentinel. */
  readonly exitCode: number;
  /** Runtime-reported OOM status supplements, not replaces, retained resource evidence. */
  readonly oomKilled: boolean;
};

/**
 * Reads current state only for the container returned by this run's create operation.
 *
 * @param host - owning launch and run
 *
 * @param id - already verified created container identity
 *
 * @param text - bounded terminal inspection
 *
 * @returns Native terminal evidence without returning the environment or other unconsumed fields
 *
 * @throws ProducerInputRunError when identity or terminal state cannot be established
 *
 * @example
 * ```ts
 * const terminal = readProducerInputContainerTerminal({ host, id, text });
 * ```
 */
export function readProducerInputContainerTerminal({ host, id, text, }: { readonly host: ProducerInputHost; readonly id: string; readonly text: string; },): ProducerInputContainerState {
  /** Terminal inspection cannot select a different container by name alone. */
  const inspection = inspectionRecord(text);
  fieldMatches({ fields: inspection, name: 'Id', expected: id });
  fieldMatches({ fields: inspection, name: 'Image', expected: host.launch.imageId });
  fieldMatches({ fields: inspection, name: 'Name', expected: `producer-input-${host.run.runId}` });
  /** The host stops running containers before recording their terminal state or removing them. */
  const state = inspection.State;
  if (!record(state))
    throw new ProducerInputRunError({ operation: 'launch-container', locator: 'container state', });
  if (state.Running === true && state.Status === 'running')
    return { state: 'running' };
  if (state.Running === false && state.Status === 'created')
    return { state: 'created' };
  if (state.Running !== false || state.Status !== 'exited' || typeof state.ExitCode !== 'number' || !Number.isSafeInteger(state.ExitCode) || typeof state.OOMKilled !== 'boolean')
    throw new ProducerInputRunError({ operation: 'launch-container', locator: 'container terminal state', });
  return { state: 'exited', exitCode: state.ExitCode, oomKilled: state.OOMKilled };
}

//endregion Native created-container evidence before Node startup
