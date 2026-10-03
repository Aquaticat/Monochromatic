/**
 Policy input and read-set internals reachable from the built artifact for unit tests.

 Not part of the authoring API;
 names and shapes change without notice.

 @internal

 @module
 */
import { BUILT_IN_POLICIES, } from './policy-engine/built-ins.ts';
import {
  declaredPreForwardInputs,
  withPolicyReadTracking,
} from './policy-engine/commit-transaction-read-tracking.ts';
import { runPolicyEngine, } from './policy-engine/engine.ts';
import {
  checkTrackedPolicy,
  effectivePolicyInputs,
} from './policy-engine/policy-check.ts';
import {
  FINGERPRINT_UNAVAILABLE,
  fingerprintPolicyInputs,
  policyInputKey,
} from './policy-engine/policy-input-fingerprint.ts';
import { recordPolicyReads, } from './policy-engine/policy-read-set.ts';
import {
  createPolicyRunLog,
  decideRerun,
  externalInputsHold,
  policyFingerprints,
} from './policy-engine/policy-read-tracking.ts';
import {
  memoizeValidationFacts,
  readSetHolds,
} from './policy-engine/policy-read-validation.ts';
import {
  INPUTS_UNDECLARED,
  parsePolicyInputs,
  resolvePolicyInputs,
  validateInputsDeclaration,
} from './trust/policy-inputs-schema.ts';

/**
 Shapes of the read-set internals exposed to built-artifact tests.
 */
export type ReadsTestExports = Readonly<{
  /**
   Internal `BUILT_IN_POLICIES`.
   */
  BUILT_IN_POLICIES: typeof BUILT_IN_POLICIES;
  /**
   Internal `checkTrackedPolicy`.
   */
  checkTrackedPolicy: typeof checkTrackedPolicy;
  /**
   Internal `createPolicyRunLog`.
   */
  createPolicyRunLog: typeof createPolicyRunLog;
  /**
   Internal `decideRerun`.
   */
  decideRerun: typeof decideRerun;
  /**
   Internal `declaredPreForwardInputs`.
   */
  declaredPreForwardInputs: typeof declaredPreForwardInputs;
  /**
   Internal `effectivePolicyInputs`.
   */
  effectivePolicyInputs: typeof effectivePolicyInputs;
  /**
   Internal `externalInputsHold`.
   */
  externalInputsHold: typeof externalInputsHold;
  /**
   Internal `FINGERPRINT_UNAVAILABLE`.
   */
  FINGERPRINT_UNAVAILABLE: typeof FINGERPRINT_UNAVAILABLE;
  /**
   Internal `fingerprintPolicyInputs`.
   */
  fingerprintPolicyInputs: typeof fingerprintPolicyInputs;
  /**
   Internal `INPUTS_UNDECLARED`.
   */
  INPUTS_UNDECLARED: typeof INPUTS_UNDECLARED;
  /**
   Internal `memoizeValidationFacts`.
   */
  memoizeValidationFacts: typeof memoizeValidationFacts;
  /**
   Internal `parsePolicyInputs`.
   */
  parsePolicyInputs: typeof parsePolicyInputs;
  /**
   Internal `policyFingerprints`.
   */
  policyFingerprints: typeof policyFingerprints;
  /**
   Internal `policyInputKey`.
   */
  policyInputKey: typeof policyInputKey;
  /**
   Internal `readSetHolds`.
   */
  readSetHolds: typeof readSetHolds;
  /**
   Internal `recordPolicyReads`.
   */
  recordPolicyReads: typeof recordPolicyReads;
  /**
   Internal `resolvePolicyInputs`.
   */
  resolvePolicyInputs: typeof resolvePolicyInputs;
  /**
   Internal `runPolicyEngine`.
   */
  runPolicyEngine: typeof runPolicyEngine;
  /**
   Internal `validateInputsDeclaration`.
   */
  validateInputsDeclaration: typeof validateInputsDeclaration;
  /**
   Internal `withPolicyReadTracking`.
   */
  withPolicyReadTracking: typeof withPolicyReadTracking;
}>;

/**
 Read-set internals as one plain object, merged into the package's test export object.
 */
export const readsTestExports: ReadsTestExports = {
  BUILT_IN_POLICIES,
  checkTrackedPolicy,
  createPolicyRunLog,
  decideRerun,
  declaredPreForwardInputs,
  effectivePolicyInputs,
  externalInputsHold,
  FINGERPRINT_UNAVAILABLE,
  fingerprintPolicyInputs,
  INPUTS_UNDECLARED,
  memoizeValidationFacts,
  parsePolicyInputs,
  policyFingerprints,
  policyInputKey,
  readSetHolds,
  recordPolicyReads,
  resolvePolicyInputs,
  runPolicyEngine,
  validateInputsDeclaration,
  withPolicyReadTracking,
};
