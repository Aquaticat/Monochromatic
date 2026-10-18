/**
 Fixture state owners for the native decision fallback catalog.

 Counters, live handles, and the workspace policy replacement stay behind named
 owners so transport, host, and lifecycle callbacks share one state boundary. @module
 */
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type {
  DecisionFallbackObservations,
  DecisionFallbackPlan,
  DecisionFallbackState
} from './native-decision-fallback-types.ts';

//region Authored policy texts stay identical across fixture runs.

/**
 Initial workspace policy admitting the complete proposed inspection.
 */
export const FIXTURE_POLICY_TEXT = 'RUL:\n The complete proposed local inspection is permitted.\n';

/**
 Replacement workspace policy prohibiting the proposed operation.
 */
export const PROHIBITED_POLICY_TEXT = 'RUL:\n The proposed operation is prohibited.\n';

//endregion

//region State factories reproduce the original fixture initial values.

/**
 Create the observation counters fixture callbacks increment.

 @returns fresh zeroed observation counters

 @example
 ```ts
 const observations = createDecisionFallbackObservations();
 ```
 */
export function createDecisionFallbackObservations(): DecisionFallbackObservations {
  return {
    assessments: 0,
    httpCalls: 0,
    attempts: 0,
    selections: 0,
    executions: 0,
    updates: 0
  };
}

/**
 Create live fixture state shared across transport, host, and operation callbacks.

 Absent SDK capability and abort retention stay optional so later reads fail
 loud through nonNullishOrThrow instead of carrying nullish unions.

 @param plan - mode plan selecting startup classification behavior

 @returns fresh fixture state matching the original initial values

 @example
 ```ts
 const state = createDecisionFallbackState({ plan });
 ```
 */
export function createDecisionFallbackState({ plan }: Readonly<{ plan: DecisionFallbackPlan }>): DecisionFallbackState {
  return {
    ordinaryChatPending: plan.startupFailure,
    requestCount: 0,
    clockOffset: 0
  };
}

/**
 Replace the workspace policy with the prohibition fixture text.

 Stale and allow-stale modes change currentness mid-run through this one write.

 @param cwd - fixture workspace holding the policy file

 @example
 ```ts
 await replaceFixturePolicyWithProhibition({ cwd: environment.options.cwd });
 ```
 */
export async function replaceFixturePolicyWithProhibition({ cwd }: Readonly<{ cwd: string }>): Promise<void> {
  /**
   Policy path stays directly under the fixture workspace root.
   */
  const policyPath = join(
    cwd,
    'AGENTS.md'
  );
  await writeFile(
    policyPath,
    PROHIBITED_POLICY_TEXT
  );
}

//endregion
