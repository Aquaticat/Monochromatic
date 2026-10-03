/**
 Recorded policy runs of one commit transaction and the decision whether a declared policy must re-run.

 Preparation records every completed run of a policy that declares its inputs.
 After a replay,
 revalidation reuses a recorded run instead of running the policy again
 only when the policy declares its inputs,
 the run proposed no patch,
 every declared input fingerprints as it did then,
 and every context read it recorded returns the same identities.
 An unrestricted policy always re-runs.

 @module
 */
import type {
  PolicyInput,
  PolicyInputs,
} from '../api/policy-input-types.ts';
import type { PolicyFinding, } from '../api/policy-types.ts';
import {
  FINGERPRINT_UNAVAILABLE,
  type InputFingerprint,
  type InputFingerprints,
  policyInputKey,
} from './policy-input-fingerprint.ts';
import type { PolicyReadSet, } from './policy-read-set.ts';

/**
 One completed policy run.
 */
export type PolicyRunRecord = Readonly<{
  /**
   Effective policy ID.
   */
  policyId: string;
  /**
   What the run read through its context.
   */
  readSet: PolicyReadSet;
  /**
   Fingerprints of its declared inputs when it ran.
   */
  fingerprints: InputFingerprints;
  /**
   Findings it returned.
   */
  findings: readonly PolicyFinding[];
}>;

/**
 Completed runs of one transaction.
 */
export type PolicyRunLog = Readonly<{
  /**
   Remembers a completed run.
   */
  record: (run: PolicyRunRecord) => void;
  /**
   Completed runs of a policy, newest first.
   */
  runsOf: (policyId: string) => readonly PolicyRunRecord[];
}>;

/**
 Read tracking handed to the policy engine inside a commit transaction.
 */
export type PolicyReadTracking = Readonly<{
  /**
   Whether a declared policy may reuse a recorded run; false during preparation.
   */
  reuse: boolean;
  /**
   Fingerprints of this phase, taken before its first policy pass.
   */
  fingerprints: InputFingerprints;
  /**
   Completed runs of the transaction.
   */
  log: PolicyRunLog;
}>;

/**
 Why a policy runs, or the run it reuses.
 */
export type RerunDecision =
  | Readonly<{
    /**
     Recorded findings stand.
     */
    kind: 'reuse';
    /**
     Reused run.
     */
    run: PolicyRunRecord;
  }>
  | Readonly<{
    /**
     The policy runs.
     */
    kind: 'run';
    /**
     Why.
     */
    reason: 'unrestricted' | 'input-changed' | 'read-changed' | 'patch-proposed' | 'not-recorded';
  }>;

/**
 Creates an empty run log.

 @returns log

 @example
 ```ts
 const log = createPolicyRunLog();
 ```
 */
export function createPolicyRunLog(): PolicyRunLog {
  /**
   Runs by policy, oldest first.
   */
  const runs = new Map<string, PolicyRunRecord[]>();
  return {
    record: function record(run,): void {
      /**
       Earlier runs of the policy.
       */
      const earlier = runs.get(run.policyId,);
      if (earlier === undefined)
        runs.set(
          run.policyId,
          [run,],
        );
      else
        earlier.push(run,);
    },
    runsOf: function runsOf(policyId,): readonly PolicyRunRecord[] {
      return (runs.get(policyId,) ?? []).toReversed();
    },
  };
}

/**
 Declared external inputs, empty for an unrestricted policy.

 @param inputs - resolved inputs

 @returns external list

 @example
 ```ts
 externalInputs({ external: [] }); // []
 ```
 */
export function externalInputs(inputs: PolicyInputs,): readonly PolicyInput[] {
  return inputs === 'unrestricted' ? [] : inputs.external;
}

/**
 Fingerprints of one policy's declared inputs out of a phase snapshot.

 @param inputs - resolved inputs

 @param fingerprints - phase snapshot

 @returns the policy's fingerprints

 @example
 ```ts
 policyFingerprints({ inputs: { external: [] }, fingerprints: new Map() });
 ```
 */
export function policyFingerprints({
  inputs,
  fingerprints,
}: Readonly<{
  inputs: PolicyInputs;
  fingerprints: InputFingerprints;
}>,): InputFingerprints {
  return new Map(externalInputs(inputs,)
    .map(function fingerprintOf(input,): readonly [
      string,
      InputFingerprint
    ] {
      /**
       Input key.
       */
      const key = policyInputKey(input,);
      return [
        key,
        fingerprints.get(key,) ?? FINGERPRINT_UNAVAILABLE,
      ];
    },),);
}

/**
 Whether every declared input fingerprints as it did when a run was recorded.

 @param inputs - resolved inputs

 @param recorded - fingerprints when the run was recorded

 @param current - fingerprints of this phase

 @returns whether every input is unchanged; an unavailable fingerprint never matches

 @example
 ```ts
 externalInputsHold({ inputs: { external: [] }, recorded: new Map(), current: new Map() }); // true
 ```
 */
export function externalInputsHold({
  inputs,
  recorded,
  current,
}: Readonly<{
  inputs: PolicyInputs;
  recorded: InputFingerprints;
  current: InputFingerprints;
}>,): boolean {
  return externalInputs(inputs,)
    .every(function inputHolds(input,): boolean {
      /**
       Input key.
       */
      const key = policyInputKey(input,);
      /**
       Fingerprint then.
       */
      const then = recorded.get(key,);
      return ((typeof then) === 'string') && (then === current.get(key,));
    },);
}

/**
 Decides whether a policy runs or reuses a recorded run.

 @param inputs - resolved inputs

 @param runs - recorded runs of the policy, newest first

 @param fingerprints - fingerprints of this phase

 @param readsHold - whether a recorded read set holds against the current candidate state

 @returns reuse of the newest run that still holds, or why the policy runs

 @example
 ```ts
 await decideRerun({ inputs: 'unrestricted', runs: [], fingerprints: new Map(), readsHold: async () => true });
 // { kind: 'run', reason: 'unrestricted' }
 ```
 */
export async function decideRerun({
  inputs,
  runs,
  fingerprints,
  readsHold,
}: Readonly<{
  inputs: PolicyInputs;
  runs: readonly PolicyRunRecord[];
  fingerprints: InputFingerprints;
  readsHold: (readSet: PolicyReadSet) => Promise<boolean>;
}>,): Promise<RerunDecision> {
  if (inputs === 'unrestricted')
    return {
      kind: 'run',
      reason: 'unrestricted',
    };
  /**
   Why the most promising run could not be reused.
   */
  const reasons: RerunDecision[] = [];
  for (const run of runs) {
    if (run.findings
      .some(function proposesPatch(finding,): boolean {
        return finding.patch !== undefined;
      },)) {
      reasons.push({
        kind: 'run',
        reason: 'patch-proposed',
      },);
      continue;
    }
    if (!externalInputsHold({
      inputs,
      recorded: run.fingerprints,
      current: fingerprints,
    },)) {
      reasons.push({
        kind: 'run',
        reason: 'input-changed',
      },);
      continue;
    }
    // oxlint-disable-next-line no-await-in-loop -- Runs are tried newest first; an earlier match skips validating the rest.
    if (await readsHold(run.readSet,))
      return {
        kind: 'reuse',
        run,
      };
    reasons.push({
      kind: 'run',
      reason: 'read-changed',
    },);
  }
  return reasons[0] ?? {
    kind: 'run',
    reason: 'not-recorded',
  };
}
