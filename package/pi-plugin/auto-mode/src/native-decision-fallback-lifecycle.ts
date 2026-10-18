/**
 Disposal owner for the native decision fallback catalog.

 Cleanup reproduces the original ordering: abort retention, session disposal,
 runtime detachment, environment drain, and logger restoration. @module
 */
import { logger } from '@monochromatic-dev/module-logger/ts';
import type { AgentSession } from '@earendil-works/pi-coding-agent';
import type { DecisionFallbackEvidenceCapture } from './native-decision-fallback-evidence.ts';
import type {
  DecisionFallbackDisposal,
  DecisionFallbackState,
  HarnessEnvironment
} from './native-decision-fallback-types.ts';

//region Cleanup ordering stays identical on success and on thrown assertions.

/**
 Build the catalog disposal owner running the original cleanup order.

 @param state - live fixture state retaining the latest abort task

 @param session - original session disposed after abort retention

 @param runtime - policy runtime detached after session idle

 @param environment - built environment drained before logger restoration

 @param capture - evidence capture restoring the original debug slot

 @returns disposal owner bound to the catalog scope

 @example
 ```ts
 await using disposal = createDecisionFallbackDisposal({
   state,
   session,
   runtime,
   environment,
   capture
 });
 ```
 */
export function createDecisionFallbackDisposal({
  state,
  session,
  runtime,
  environment,
  capture
}: Readonly<{
  state: DecisionFallbackState;
  session: AgentSession;
  runtime: Readonly<{ detach: () => void }>;
  environment: HarnessEnvironment;
  capture: DecisionFallbackEvidenceCapture;
}>): DecisionFallbackDisposal {
  return {
    /**
     Cleanup runs the original abort, disposal, drain, and restore sequence.

     @returns completion of the original catalog cleanup
     */
    async [Symbol.asyncDispose](): Promise<void> {
      await state.abortTask;
      session.dispose();
      await session.agent
        .waitForIdle();
      runtime.detach();
      await environment.drain();
      await logger.flush();
      capture.restore();
    }
  };
}

//endregion
