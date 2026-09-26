/**
 Starts policy read tracking for one phase of a commit transaction.

 Preparation starts a new run log and never reuses;
 each revalidation after a replay keeps preparation's log,
 so a declared policy whose reads and inputs still hold reuses its recorded findings.
 Every phase fingerprints the declared inputs of the enabled pre-forward policies
 before its first policy pass.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';
import type { PolicyInput, } from '../api/policy-input-types.ts';
import { BUILT_IN_POLICIES, } from './built-ins.ts';
import type { CommitTransactionPolicyOptions, } from './commit-transaction-types.ts';
import { effectivePolicyInputs, } from './policy-check.ts';
import {
  type FingerprintLocation,
  fingerprintPolicyInputs,
} from './policy-input-fingerprint.ts';
import {
  createPolicyRunLog,
  externalInputs,
} from './policy-read-tracking.ts';

/**
 Module logger.
 */
const l = tagged({ tag: 'cli-git', },);

/**
 Declared external inputs of every enabled pre-forward policy.

 @param policyOptions - trusted policy options

 @returns inputs, possibly repeated

 @example
 ```ts
 declaredPreForwardInputs({});
 ```
 */
export function declaredPreForwardInputs(policyOptions: CommitTransactionPolicyOptions,): readonly PolicyInput[] {
  /**
   Explicit severities.
   */
  const severities = policyOptions.config
    ?.policies
    ?? {};
  return (policyOptions.registeredPolicies ?? BUILT_IN_POLICIES)
    .filter(function isEnabledPreForward(policy,): boolean {
      return policy.triggers
        .includes('pre-forward',)
        && ((severities[policy.name] ?? policy.defaultSeverity) !== 'off');
    },)
    .flatMap(function inputsOf(policy,): readonly PolicyInput[] {
      return externalInputs(effectivePolicyInputs(policy,),);
    },);
}

/**
 Adds read tracking for the next phase to the policy options.

 @param policyOptions - trusted policy options, carrying preparation's tracking during revalidation

 @param location - where declared inputs are fingerprinted

 @returns options every policy pass of the phase uses

 @example
 ```ts
 const tracked = await withPolicyReadTracking({ policyOptions, location });
 ```
 */
export async function withPolicyReadTracking({
  policyOptions,
  location,
}: Readonly<{
  policyOptions: CommitTransactionPolicyOptions;
  location: FingerprintLocation;
}>,): Promise<CommitTransactionPolicyOptions> {
  /**
   Preparation's tracking, present during revalidation.
   */
  const earlier = policyOptions.readTracking;
  /**
   Fingerprints taken before the phase's first pass.
   */
  const fingerprints = await fingerprintPolicyInputs({
    location,
    inputs: declaredPreForwardInputs(policyOptions,),
  },);
  tagged({
    tag: withPolicyReadTracking.name,
    l,
  },)
    .debug(`${earlier === undefined ? 'preparation records' : 'revalidation reuses'} policy reads over ${String(fingerprints.size,)} declared inputs`,);
  return {
    ...policyOptions,
    readTracking: {
      reuse: earlier !== undefined,
      fingerprints,
      log: earlier?.log ?? createPolicyRunLog(),
    },
  };
}
