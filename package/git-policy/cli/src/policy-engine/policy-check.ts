/**
 One policy check:
 the plugin callback settled without conflating its exception with engine validation,
 and inside a commit transaction its context reads recorded,
 or a recorded run reused after a replay.

 @module
 */
import { caughtValueText, } from '@monochromatic-dev/module-caught-value/ts';
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { LazyPolicyGitFacts, } from '../api/context-types.ts';
import type { PolicyInputs, } from '../api/policy-input-types.ts';
import type {
  PolicyContext,
  PolicyFinding,
} from '../api/policy-types.ts';
import { recordPolicyReads, } from './policy-read-set.ts';
import {
  decideRerun,
  type PolicyReadTracking,
  policyFingerprints,
} from './policy-read-tracking.ts';
import { readSetHolds, } from './policy-read-validation.ts';
import type { RuntimePolicyDefinition, } from './types.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Settled plugin check result preserving whether plugin code threw.
 */
export type PolicyCheckResult = Readonly<{
  /**
   Successful check discriminator.
   */
  status: 'complete';
  /**
   Unvalidated plugin findings.
   */
  findings: readonly PolicyFinding[];
}> | Readonly<{
  /**
   Thrown check discriminator.
   */
  status: 'threw';
  /**
   Exact thrown plugin value.
   */
  error: unknown;
}>;

/**
 Read tracking of one engine pass.
 */
export type PassReadTracking = Readonly<{
  /**
   Transaction tracking.
   */
  tracking: PolicyReadTracking;
  /**
   Resolved inputs by effective policy ID.
   */
  policyInputs?: ReadonlyMap<string, PolicyInputs>;
  /**
   Pass facts memoized for read-set validation.
   */
  validationFacts: LazyPolicyGitFacts;
}>;

/**
 Settles one plugin callback without conflating its exception with engine validation.

 @param policy - current runtime plugin

 @param context - trigger-specific policy facts

 @param options - validated plugin options

 @returns discriminated plugin result

 @example
 ```ts
 const result = await checkPolicy({ policy, context, options: undefined });
 ```
 */
export async function checkPolicy({
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
 Inputs a policy declared:
 the value config loading resolved,
 else its static declaration,
 else `'unrestricted'`.

 @param policy - runtime policy

 @param policyInputs - resolved inputs by effective policy ID

 @returns effective inputs

 @example
 ```ts
 effectivePolicyInputs({ policy: finalNewlinePolicy }); // { external: [] }
 ```
 */
export function effectivePolicyInputs({
  policy,
  policyInputs,
}: Readonly<{
  policy: RuntimePolicyDefinition;
  policyInputs?: ReadonlyMap<string, PolicyInputs>;
}>,): PolicyInputs {
  /**
   Value resolved at config loading.
   */
  const resolved = policyInputs?.get(policy.name,);
  if (resolved !== undefined)
    return resolved;
  return (policy.inputs === undefined) || ((typeof policy.inputs) === 'function')
    ? 'unrestricted'
    : policy.inputs;
}

/**
 Whether a read set holds, treating a failed validation read as a change so the policy runs and reports it.

 @param pass - pass tracking

 @param readSet - recorded reads

 @returns whether the reads hold

 @example
 ```ts
 await readsHoldSafely({ pass, readSet });
 ```
 */
async function readsHoldSafely({
  pass,
  readSet,
}: Readonly<{
  pass: PassReadTracking;
  readSet: Parameters<typeof readSetHolds>[0]['readSet'];
}>,): Promise<boolean> {
  try {
    return await readSetHolds({
      readSet,
      facts: pass.validationFacts,
    },);
  }
  catch (error: unknown) {
    l.debug(`read-set validation failed, so the policy runs: ${caughtValueText(error,)}`,);
    return false;
  }
}

/**
 Checks one policy, recording its reads inside a commit transaction and reusing a recorded run after a replay when its reads and inputs still hold.

 @param policy - current runtime policy

 @param context - trigger-specific policy facts

 @param options - validated policy options

 @param pass - pass read tracking, absent outside a commit transaction

 @returns discriminated result

 @example
 ```ts
 await checkTrackedPolicy({ policy, context, options: undefined, pass });
 ```
 */
export async function checkTrackedPolicy({
  policy,
  context,
  options,
  pass,
}: Readonly<{
  policy: RuntimePolicyDefinition;
  context: PolicyContext;
  options: unknown;
  pass?: PassReadTracking;
}>,): Promise<PolicyCheckResult> {
  if (pass === undefined)
    return await checkPolicy({
      policy,
      context,
      options,
    },);
  /**
   Tagged check logger.
   */
  const rl = tagged({
    tag: checkTrackedPolicy.name,
    l,
  },);
  /**
   Transaction tracking.
   */
  const { tracking, } = pass;
  /**
   Declared inputs.
   */
  const inputs = effectivePolicyInputs({
    policy,
    ...(pass.policyInputs === undefined ? {} : { policyInputs: pass.policyInputs, }),
  },);
  if (tracking.reuse) {
    /**
     Reuse or the reason to run.
     */
    const decision = await decideRerun({
      inputs,
      runs: tracking.log
        .runsOf(policy.name,),
      fingerprints: tracking.fingerprints,
      readsHold: async function readsHold(readSet,): Promise<boolean> {
        return await readsHoldSafely({
          pass,
          readSet,
        },);
      },
    },);
    if (decision.kind === 'reuse') {
      rl.debug(`${policy.name} reads and inputs are unchanged; its recorded findings stand`,);
      return {
        status: 'complete',
        findings: decision.run
          .findings
          .map(function copyFinding(finding,): PolicyFinding {
            return { ...finding, };
          },),
      };
    }
    rl.debug(`${policy.name} re-runs: ${decision.reason}`,);
  }
  /**
   Recording view for this run.
   */
  const recorder = recordPolicyReads(context.git,);
  /**
   Settled run.
   */
  const result = await checkPolicy({
    policy,
    context: {
      ...context,
      git: recorder.facts,
    },
    options,
  },);
  /**
   What the run read, fixed at completion.
   */
  const readSet = recorder.finish();
  if ((result.status === 'complete') && (inputs !== 'unrestricted')
    && Array.isArray(result.findings,))
    tracking.log
      .record({
        policyId: policy.name,
        readSet,
        fingerprints: policyFingerprints({
          inputs,
          fingerprints: tracking.fingerprints,
        },),
        findings: result.findings
          .map(function copyFinding(finding: PolicyFinding,): PolicyFinding {
            return { ...finding, };
          },),
      },);
  return result;
}
