/**
 * Sequential policy-stage execution shared by built-in and plugin stages.
 *
 * @module
 */
import type {
  PolicyContext,
  PolicyFinding,
  PolicySeverity,
  PolicyTrigger,
} from '../api/policy-types.ts';
import {
  createConfigurationWarningEvent,
  createEngineFailureEvent,
  createFindingEvent,
  type PolicyEvent,
} from './events.ts';
import type { RuntimePolicyDefinition, } from './types.ts';

/**
 * One sequential policy stage outcome.
 */
export type PolicyStageResult = Readonly<{
  /**
   * Settled ordered stage events.
   */
  events: readonly PolicyEvent[];
  /**
   * Whether every started policy completed.
   */
  complete: boolean;
  /**
   * Whether an error finding requested an early stop.
   */
  stopped: boolean;
}>;

/**
 * Confirms returned policy findings have runtime shape.
 *
 * @param findings - untrusted policy return value
 *
 * @returns whether every finding has required strings
 */
function findingsAreValid(findings: readonly PolicyFinding[],): boolean {
  return findings.every(function findingIsValid(finding,) {
    return ((typeof finding.code) === 'string')
      && (finding.code
        .length
        > 0)
      && ((typeof finding.message) === 'string')
      && (finding.message
        .length
        > 0);
  },);
}

/* oxlint-disable typescript/prefer-readonly-parameter-types -- Internal registry contains callback-bearing declarations; stage reads but never mutates them, as documented in docs/troubleshooting/oxlint-prefer-readonly-authoring-identity.md. */
/**
 * Runs one ordered policy group.
 *
 * @param policies - built-in or plugin definitions in stable order
 *
 * @param context - stage-specific raw and transformed facts
 *
 * @param trigger - active lifecycle point
 *
 * @param severities - validated effective severity map
 *
 * @param selectedPolicyIds - optional direct-check selection
 *
 * @param escapedPolicyIds - complete-invocation skipped IDs
 *
 * @param policyOptions - validated policy option outputs
 *
 * @param keepGoing - whether error findings permit later checks
 *
 * @param sequence - first stage event sequence
 *
 * @returns settled stage outcome
 *
 * @example
 * ```ts
 * await runPolicyStage({ policies: [], context, trigger: 'pre-forward', severities: {}, selectedPolicyIds: new Set(), escapedPolicyIds: new Set(), policyOptions: new Map(), keepGoing: false, sequence: 0 });
 * ```
 */
export async function runPolicyStage({
  policies,
  context,
  trigger,
  severities,
  selectedPolicyIds,
  escapedPolicyIds,
  policyOptions,
  keepGoing,
  sequence,
}: Readonly<{
  policies: readonly RuntimePolicyDefinition[];
  context: PolicyContext;
  trigger: PolicyTrigger;
  severities: Readonly<Record<string, PolicySeverity>>;
  selectedPolicyIds: ReadonlySet<string>;
  escapedPolicyIds: ReadonlySet<string>;
  policyOptions: ReadonlyMap<string, unknown>;
  keepGoing: boolean;
  sequence: number;
}>,): Promise<PolicyStageResult> {
  /**
   * Stage-local buffered events.
   */
  const events: PolicyEvent[] = [];
  for (const policy of policies) {
    if (!policy.triggers
      .includes(trigger,))
      continue;
    if ((selectedPolicyIds.size > 0) && (!selectedPolicyIds.has(policy.name,)))
      continue;
    if (escapedPolicyIds.has(policy.name,))
      continue;
    /**
     * Effective persistent severity.
     */
    const severity = severities[policy.name] ?? policy.defaultSeverity;
    if (severity === 'off')
      continue;
    /**
     * Whether selected warning severity weakens enforcement.
     */
    const warnUnsafe = (severity === 'warn') && (!policy.warnSafe);
    try {
      /**
       * Findings produced by current sequential policy.
       */
      // oxlint-disable-next-line no-await-in-loop -- Policy contract requires sequential checks in fixed registration order.
      const findings = await policy.check({
        context,
        options: policyOptions.get(policy.name,),
      },);
      if (!findingsAreValid(findings,))
        throw new TypeError(`Policy ${policy.name} returned an invalid finding.`,);
      events.push(...findings.map(function toFindingEvent(
        finding,
        findingIndex,
      ) {
        return createFindingEvent({
          sequence: sequence + events.length
            + findingIndex,
          trigger,
          policyId: policy.name,
          severity,
          code: finding.code,
          message: finding.message,
          ...(finding.path === undefined ? {} : { path: finding.path, }),
          ...(finding.location === undefined ? {} : { location: finding.location, }),
          fix: finding.patch === undefined ? 'none' : 'available',
        },);
      },),);
      if (warnUnsafe)
        events.push(createConfigurationWarningEvent({
          sequence: sequence + events.length,
          trigger,
          policyId: policy.name,
        },),);
      if ((severity === 'error') && (findings.length > 0)
        && (!keepGoing))
        return {
          events,
          complete: true,
          stopped: true,
        };
    }
    catch (error: unknown) {
      events.push(createEngineFailureEvent({
        sequence: sequence + events.length,
        code: 'policy-incomplete',
        message: Error.isError(error,) ? error.message : String(error,),
        trigger,
        policyId: policy.name,
      },),);
      return {
        events,
        complete: false,
        stopped: true,
      };
    }
  }
  return {
    events,
    complete: true,
    stopped: false,
  };
}
/* oxlint-enable typescript/prefer-readonly-parameter-types */
