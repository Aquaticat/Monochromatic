/**
 * Stable policy JSONL events.
 *
 * @module
 */

import type {
  ActivePolicySeverity,
  FindingLocation,
  PolicyTrigger,
  RepositoryPath,
} from '../api/policy-types.ts';

/**
 * Current JSONL schema version.
 */
const SCHEMA_VERSION = 1;

/**
 * Finding event emitted from stable policy pass.
 *
 * @example
 * ```ts
 * const event: FindingEvent = { schemaVersion: 1, sequence: 0, type: 'finding', trigger: 'pre-forward', policyId: 'require-root', severity: 'error', code: 'require-root/not-at-root', message: 'Not at root', fix: 'none' };
 * ```
 */
export type FindingEvent = Readonly<{
  /** Schema version. */
  schemaVersion: 1;
  /** Invocation-local sequence. */
  sequence: number;
  /** Event discriminator. */
  type: 'finding';
  /** Lifecycle trigger. */
  trigger: PolicyTrigger;
  /** Effective policy ID. */
  policyId: string;
  /** Active severity. */
  severity: ActivePolicySeverity;
  /** Fully qualified finding code. */
  code: string;
  /** Human-readable message. */
  message: string;
  /** Optional repository path. */
  path?: RepositoryPath;
  /** Optional byte location. */
  location?: FindingLocation;
  /** Whether correction remains available. */
  fix: 'none' | 'available';
}>;

/**
 * Engine failure event.
 *
 * @example
 * ```ts
 * const event: EngineFailureEvent = { schemaVersion: 1, sequence: 0, type: 'engine-failure', code: 'policy-incomplete', message: 'Policy failed' };
 * ```
 */
export type EngineFailureEvent = Readonly<{
  /** Schema version. */
  schemaVersion: 1;
  /** Invocation-local sequence. */
  sequence: number;
  /** Event discriminator. */
  type: 'engine-failure';
  /** Stable failure code. */
  code: 'config-invalid' | 'policy-incomplete';
  /** Human-readable message. */
  message: string;
  /** Lifecycle trigger. */
  trigger?: PolicyTrigger;
  /** Responsible policy ID. */
  policyId?: string;
}>;

/**
 * Policy event supported by first engine slice.
 *
 * @example
 * ```ts
 * const events: readonly PolicyEvent[] = [];
 * ```
 */
export type PolicyEvent = FindingEvent | EngineFailureEvent;

/**
 * Creates finding event while copying retained fields.
 *
 * @param options - validated finding event values
 *
 * @returns immutable event value
 *
 * @example
 * ```ts
 * createFindingEvent({ sequence: 0, trigger: 'pre-forward', policyId: 'require-root', severity: 'error', code: 'not-at-root', message: 'Not at root', fix: 'none' });
 * ```
 */
export function createFindingEvent({
  sequence,
  trigger,
  policyId,
  severity,
  code,
  message,
  path,
  location,
  fix,
}: Omit<FindingEvent, 'schemaVersion' | 'type'>,): FindingEvent {
  return {
    schemaVersion: SCHEMA_VERSION,
    sequence,
    type: 'finding',
    trigger,
    policyId,
    severity,
    code: `${policyId}/${code}`,
    message,
    ...(path === undefined ? {} : { path, }),
    ...(location === undefined
      ? {}
      : {
        location: {
          byteStart: location.byteStart,
          byteEnd: location.byteEnd,
        },
      }),
    fix,
  };
}

/**
 * Creates engine failure event.
 *
 * @param options - failure fields except common schema fields
 *
 * @returns immutable event value
 *
 * @example
 * ```ts
 * createEngineFailureEvent({ sequence: 0, code: 'config-invalid', message: 'Invalid config' });
 * ```
 */
export function createEngineFailureEvent({
  sequence,
  code,
  message,
  trigger,
  policyId,
}: Omit<EngineFailureEvent, 'schemaVersion' | 'type'>,): EngineFailureEvent {
  return {
    schemaVersion: SCHEMA_VERSION,
    sequence,
    type: 'engine-failure',
    code,
    message,
    ...(trigger === undefined ? {} : { trigger, }),
    ...(policyId === undefined ? {} : { policyId, }),
  };
}

/**
 * Serializes events as compact LF-terminated JSONL.
 *
 * @param events - ordered invocation events
 *
 * @returns empty string or one LF-terminated line per event
 *
 * @example
 * ```ts
 * renderPolicyEvents([]); // ''
 * ```
 */
export function renderPolicyEvents(events: readonly PolicyEvent[],): string {
  if (events.length === 0)
    return '';
  return `${events.map(function serializePolicyEvent(event,) {
    return JSON.stringify(event,);
  },).join('\n',)}\n`;
}
