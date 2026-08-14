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
export type FindingEvent = {
  /**
   * Schema version.
   */
  schemaVersion: 1;
  /**
   * Invocation-local sequence.
   */
  sequence: number;
  /**
   * Event discriminator.
   */
  type: 'finding';
  /**
   * Lifecycle trigger.
   */
  trigger: PolicyTrigger;
  /**
   * Effective policy ID.
   */
  policyId: string;
  /**
   * Active severity.
   */
  severity: ActivePolicySeverity;
  /**
   * Fully qualified finding code.
   */
  code: string;
  /**
   * Human-readable message.
   */
  message: string;
  /**
   * Optional repository path.
   */
  path?: RepositoryPath;
  /**
   * Optional byte location.
   */
  location?: FindingLocation;
  /**
   * Whether correction remains available.
   */
  fix: 'none' | 'available';
};

/**
 * Stable engine failure classification.
 *
 * @example
 * ```ts
 * const code: EngineFailureCode = 'patch-conflict';
 * ```
 */
export type EngineFailureCode =
  | 'config-invalid'
  | 'config-untrusted'
  | 'config-changed'
  | 'core-incomplete'
  | 'plugin-threw'
  | 'policy-incomplete'
  | 'content-unavailable'
  | 'patch-invalid'
  | 'patch-conflict'
  | 'fix-cycle'
  | 'fix-pass-limit'
  | 'transaction-failed'
  | 'trust-consent-unavailable'
  | 'trust-failed';

/**
 * Engine failure event.
 *
 * @example
 * ```ts
 * const event: EngineFailureEvent = { schemaVersion: 1, sequence: 0, type: 'engine-failure', code: 'policy-incomplete', message: 'Policy failed' };
 * ```
 */
export type EngineFailureEvent = {
  /**
   * Schema version.
   */
  schemaVersion: 1;
  /**
   * Invocation-local sequence.
   */
  sequence: number;
  /**
   * Event discriminator.
   */
  type: 'engine-failure';
  /**
   * Stable failure code.
   */
  code: EngineFailureCode;
  /**
   * Human-readable message.
   */
  message: string;
  /**
   * Lifecycle trigger.
   */
  trigger?: PolicyTrigger;
  /**
   * Responsible policy ID.
   */
  policyId?: string;
  /**
   * Repository path responsible for path-specific failure.
   */
  path?: RepositoryPath;
};

/**
 * Landed commit retained after post-commit gate blocks backup.
 *
 * @example
 * ```ts
 * const event: CommitLandedEvent = { schemaVersion: 1, sequence: 1, type: 'commit-landed', oid: 'abc', outcome: 'post-commit-blocked', message: 'Commit remains local.' };
 * ```
 */
export type CommitLandedEvent = {
  /**
   * Schema version.
   */
  schemaVersion: 1;
  /**
   * Invocation-local sequence.
   */
  sequence: number;
  /**
   * Event discriminator.
   */
  type: 'commit-landed';
  /**
   * Policy identifier is absent for landed-state event.
   */
  policyId?: never;
  /**
   * Exact landed commit object ID.
   */
  oid: string;
  /**
   * Stable blocked-backup outcome.
   */
  outcome: 'post-commit-blocked';
  /**
   * Explicit retry-safe state explanation.
   */
  message: string;
};

/**
 * Expected non-configurable fixed-core rejection.
 *
 * @example
 * ```ts
 * const event: CoreFindingEvent = { schemaVersion: 1, sequence: 0, type: 'core-finding', trigger: 'pre-forward', coreId: 'commit-only', code: 'commit-only/pathspec-required', message: 'Name a path.' };
 * ```
 */
export type CoreFindingEvent = {
  /**
   * Schema version.
   */
  schemaVersion: 1;
  /**
   * Invocation-local sequence.
   */
  sequence: number;
  /**
   * Event discriminator.
   */
  type: 'core-finding';
  /**
   * Lifecycle trigger.
   */
  trigger: 'pre-forward';
  /**
   * Non-configurable fixed-core identifier.
   */
  coreId: 'commit-only';
  /**
   * Policy identifier is intentionally absent for fixed core.
   */
  policyId?: never;
  /**
   * Stable fully qualified rejection code.
   */
  code: string;
  /**
   * Human-readable rejection.
   */
  message: string;
};

/**
 * Non-blocking warning about unsafe severity configuration.
 *
 * @example
 * ```ts
 * const event: ConfigurationWarningEvent = { schemaVersion: 1, sequence: 0, type: 'configuration-warning', trigger: 'pre-forward', policyId: 'add-explicit', code: 'warn-unsafe', message: 'Policy is warn-unsafe.' };
 * ```
 */
export type ConfigurationWarningEvent = {
  /**
   * Schema version.
   */
  schemaVersion: 1;
  /**
   * Invocation-local sequence.
   */
  sequence: number;
  /**
   * Event discriminator.
   */
  type: 'configuration-warning';
  /**
   * Lifecycle trigger.
   */
  trigger: PolicyTrigger;
  /**
   * Policy with unsafe warning severity.
   */
  policyId: string;
  /**
   * Stable warning code.
   */
  code: 'warn-unsafe';
  /**
   * Human-readable warning.
   */
  message: string;
};

/**
 * Successful policy correction summary.
 *
 * @example
 * ```ts
 * const event: FixSummaryEvent = { schemaVersion: 1, sequence: 0, type: 'fix-summary', trigger: 'direct-fix', passes: 1, changedPaths: ['a.txt'] };
 * ```
 */
export type FixSummaryEvent = {
  /**
   * Schema version.
   */
  schemaVersion: 1;
  /**
   * Invocation-local sequence.
   */
  sequence: number;
  /**
   * Event discriminator.
   */
  type: 'fix-summary';
  /**
   * Policy identifier is absent for aggregate summary.
   */
  policyId?: never;
  /**
   * Fixable lifecycle trigger.
   */
  trigger: 'pre-forward' | 'direct-fix';
  /**
   * Number of private candidate changes before stability.
   */
  passes: number;
  /**
   * Unique changed paths in Git byte order.
   */
  changedPaths: readonly RepositoryPath[];
};

/**
 * Policy event supported by first engine slice.
 *
 * @example
 * ```ts
 * const events: readonly PolicyEvent[] = [];
 * ```
 */
export type PolicyEvent = CommitLandedEvent | ConfigurationWarningEvent | CoreFindingEvent | FindingEvent | FixSummaryEvent | EngineFailureEvent;

/**
 * Creates successful policy correction summary.
 *
 * @param sequence - invocation-local event order
 *
 * @param trigger - fixable lifecycle point
 *
 * @param passes - changed private candidate passes
 *
 * @param changedPaths - unique Git-byte-ordered paths
 *
 * @returns fresh summary event
 *
 * @example
 * ```ts
 * createFixSummaryEvent({ sequence: 0, trigger: 'direct-fix', passes: 1, changedPaths: ['a.txt'] });
 * ```
 */
export function createFixSummaryEvent({
  sequence,
  trigger,
  passes,
  changedPaths,
}: Readonly<Omit<FixSummaryEvent, 'schemaVersion' | 'type'>>,): FixSummaryEvent {
  return {
    schemaVersion: SCHEMA_VERSION,
    sequence,
    type: 'fix-summary',
    trigger,
    passes,
    changedPaths,
  };
}

/**
 * Creates finding event while copying retained fields.
 *
 * @param sequence - invocation-local event order
 *
 * @param trigger - lifecycle point being checked
 *
 * @param policyId - effective policy identifier
 *
 * @param severity - active policy severity
 *
 * @param code - policy-local finding code
 *
 * @param message - human-readable explanation
 *
 * @param path - optional affected repository path
 *
 * @param location - optional exact byte range
 *
 * @param fix - whether correction remains available
 *
 * @returns fresh event value
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
}: Readonly<Omit<FindingEvent, 'schemaVersion' | 'type'>>,): FindingEvent {
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
 * Creates explicit landed-commit outcome after blocked backup.
 *
 * @param sequence - invocation-local event order
 *
 * @param oid - exact landed commit object ID
 *
 * @returns fresh landed-commit event
 *
 * @example
 * ```ts
 * createCommitLandedEvent({ sequence: 1, oid: 'abc' });
 * ```
 */
export function createCommitLandedEvent({
  sequence,
  oid,
}: Readonly<{
  sequence: number;
  oid: string;
}>,): CommitLandedEvent {
  return {
    schemaVersion: SCHEMA_VERSION,
    sequence,
    type: 'commit-landed',
    oid,
    outcome: 'post-commit-blocked',
    message: `Commit ${oid} remains local; post-commit gate blocked automatic backup.`,
  };
}

/**
 * Creates structured non-configurable core finding.
 *
 * @param sequence - invocation-local event order
 *
 * @param coreId - fixed core identifier
 *
 * @param code - core-local finding code
 *
 * @param message - user-facing rejection
 *
 * @returns immutable core finding
 *
 * @example
 * ```ts
 * createCoreFindingEvent({ sequence: 0, coreId: 'commit-only', code: 'pathspec-required', message: 'Name a path.' });
 * ```
 */
export function createCoreFindingEvent({
  sequence,
  coreId,
  code,
  message,
}: Readonly<{
  sequence: number;
  coreId: CoreFindingEvent['coreId'];
  code: string;
  message: string;
}>,): CoreFindingEvent {
  return {
    schemaVersion: SCHEMA_VERSION,
    sequence,
    type: 'core-finding',
    trigger: 'pre-forward',
    coreId,
    code: `${coreId}/${code}`,
    message,
  };
}

/**
 * Creates machine-readable unsafe-severity warning.
 *
 * @param sequence - invocation-local event order
 *
 * @param trigger - lifecycle point being checked
 *
 * @param policyId - warn-unsafe policy identifier
 *
 * @returns fresh warning event
 *
 * @example
 * ```ts
 * createConfigurationWarningEvent({ sequence: 0, trigger: 'pre-forward', policyId: 'add-explicit' });
 * ```
 */
export function createConfigurationWarningEvent({
  sequence,
  trigger,
  policyId,
}: Readonly<{
  sequence: number;
  trigger: PolicyTrigger;
  policyId: string;
}>,): ConfigurationWarningEvent {
  return {
    schemaVersion: SCHEMA_VERSION,
    sequence,
    type: 'configuration-warning',
    trigger,
    policyId,
    code: 'warn-unsafe',
    message: `Policy ${policyId} is warn-unsafe but configured as warn.`,
  };
}

/**
 * Creates engine failure event.
 *
 * @param sequence - invocation-local event order
 *
 * @param code - stable engine failure code
 *
 * @param message - human-readable failure explanation
 *
 * @param trigger - optional lifecycle point
 *
 * @param policyId - optional responsible policy ID
 *
 * @param path - optional repository path responsible for failure
 *
 * @returns fresh event value
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
  path,
}: Readonly<Omit<EngineFailureEvent, 'schemaVersion' | 'type'>>,): EngineFailureEvent {
  return {
    schemaVersion: SCHEMA_VERSION,
    sequence,
    type: 'engine-failure',
    code,
    message,
    ...(trigger === undefined ? {} : { trigger, }),
    ...(policyId === undefined ? {} : { policyId, }),
    ...(path === undefined ? {} : { path, }),
  };
}

/**
 * Serializes events as compact LF-terminated JSONL.
 *
 * @param events - ordered invocation events
 *
 * @returns empty string or one LF-terminated line per event
 *
 * @mutates events - `JSON.stringify` may invoke hooks on event records.
 *
 * @example
 * ```ts
 * renderPolicyEvents([]); // ''
 * ```
 */
export function renderPolicyEvents(events: readonly PolicyEvent[],): string {
  if (events.length === 0)
    return '';
  /**
   * Compact event lines accumulated without another effect boundary.
   */
  const lines: string[] = [];
  for (const event of events)
    lines.push(JSON.stringify(event,),);
  return `${lines.join('\n',)}\n`;
}
