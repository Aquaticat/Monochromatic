/**
 * Sequential policy-stage execution shared by built-in and plugin stages.
 *
 * @module
 */
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';

import type {
  PolicyContext,
  PolicyFinding,
  PolicyPatch,
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
  /**
   * Ordered engine-owned patches proposed by findings.
   */
  patches: readonly PolicyPatch[];
  /**
   * Whether current policy proposed a patch and ended provisional pass.
   */
  patchProposed: boolean;
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

/**
 * Settled plugin check result preserving whether plugin code threw.
 */
type PolicyCheckResult = Readonly<{
  /**
   * Successful check discriminator.
   */
  status: 'complete';
  /**
   * Unvalidated plugin findings.
   */
  findings: readonly PolicyFinding[];
}> | Readonly<{
  /**
   * Thrown check discriminator.
   */
  status: 'threw';
  /**
   * Exact thrown plugin value.
   */
  error: unknown;
}>;

/**
 * Settles one plugin callback without conflating its exception with engine validation.
 *
 * @param policy - current runtime plugin
 *
 * @param context - trigger-specific policy facts
 *
 * @param options - validated plugin options
 *
 * @returns discriminated plugin result
 *
 * @example
 * ```ts
 * const result = await checkPolicy({ policy, context, options: undefined });
 * ```
 */
async function checkPolicy({
  policy,
  context,
  options,
}: Readonly<{
  policy: RuntimePolicyDefinition;
  context: PolicyContext;
  options: unknown;
}>,): Promise<PolicyCheckResult> {
  try {
    return {
      status: 'complete',
      findings: await policy.check({
        context,
        options,
      },),
    };
  }
  catch (error: unknown) {
    return {
      status: 'threw',
      error,
    };
  }
}

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
  /**
   * Stage-local ordered patch proposals.
   */
  const patches: PolicyPatch[] = [];
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
    /**
     * Settled callback result preserving plugin ownership of thrown values.
     */
    // oxlint-disable-next-line no-await-in-loop -- Policy contract requires sequential checks in fixed registration order.
    const checkResult = await checkPolicy({
      policy,
      context,
      options: policyOptions.get(policy.name,),
    },);
    if (checkResult.status === 'threw') {
      events.push(createEngineFailureEvent({
        sequence: sequence + events.length,
        code: 'plugin-threw',
        message: caughtValueText(checkResult.error,),
        trigger,
        policyId: policy.name,
      },),);
      return {
        events,
        complete: false,
        stopped: true,
        patches,
        patchProposed: false,
      };
    }
    try {
      /**
       * Findings produced by current sequential policy.
       */
      const { findings, } = checkResult;
      if (!findingsAreValid(findings,))
        throw new TypeError(`Policy ${policy.name} returned an invalid finding.`,);
      /**
       * Current policy patch proposals requiring whole-sequence restart.
       */
      const proposedPatches = findings.flatMap(function extractPatch(finding,) {
        return finding.patch === undefined ? [] : [finding.patch,];
      },);
      patches.push(...proposedPatches,);
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
      if (proposedPatches.length > 0)
        return {
          events,
          complete: true,
          stopped: false,
          patches,
          patchProposed: true,
        };
      if ((severity === 'error') && (findings.length > 0)
        && (!keepGoing))
        return {
          events,
          complete: true,
          stopped: true,
          patches,
          patchProposed: false,
        };
    }
    catch (error: unknown) {
      events.push(createEngineFailureEvent({
        sequence: sequence + events.length,
        code: 'policy-incomplete',
        message: caughtValueText(error,),
        trigger,
        policyId: policy.name,
      },),);
      return {
        events,
        complete: false,
        stopped: true,
        patches,
        patchProposed: false,
      };
    }
  }
  return {
    events,
    complete: true,
    stopped: false,
    patches,
    patchProposed: false,
  };
}
