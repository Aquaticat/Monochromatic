/** Original binding segments bracket internal reads with fresh dependency checks. @module */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { JudgmentConstructionError } from './judgment-error.ts';
import type { JudgmentDependencyRetained, JudgmentDependencyChecks } from './judgment-dependency-types.ts';

/** Binding diagnostics never include source contents or returned values. */
const l = tagged({ tag: 'auto-mode-judgment-binding-segment' });

//region Release internal freshness caching before postcheck callbacks and observers.
/**
 Bind the original shared segment state to fresh entry and exit checks.

 @param input - retained eligibility state and original external check capabilities

 @returns synchronous binding boundary preserving original result or failure

 @example createJudgmentBindingSegment(input);
 */
export function createJudgmentBindingSegment({ retained, ready, trace }: Readonly<{
  retained: JudgmentDependencyRetained;
  ready: () => void;
  trace: (event: string) => void;
}>): JudgmentDependencyChecks['bindingSegment'] {
  /** Entry diagnostics do not trigger readiness or trace callbacks. */
  const rl = tagged({ tag: createJudgmentBindingSegment.name, l });
  rl.debug('binding original synchronous dependency segment');
  /**
   Preserve operation and postcheck failures as ordered peers after releasing freshness caching.

   @param run - original synchronous internal identity operation

   @returns original operation result after successful postcheck

   @throws JudgmentConstructionError when original binding segments nest

   @throws AggregateError when both original operation and postcheck fail
   */
  function bindingSegment<Result>(run: () => Result): Result {
    /** Each operation keeps its own diagnostic boundary. */
    const bl = tagged({ tag: bindingSegment.name, l: rl });
    if (retained.bindingSegmentActive) throw new JudgmentConstructionError('Original binding segments cannot nest');
    ready();
    /** An outcome wrapper distinguishes successful undefined from an absent successful operation. */
    const completed: { outcome?: Readonly<{ value: Result }>; failure?: Readonly<{ cause: unknown }> } = {};
    {
      retained.bindingSegmentActive = true;
      using segment = { [Symbol.dispose]() { retained.bindingSegmentActive = false; } };
      try { completed.outcome = { value: run() }; }
      catch (error) {
        bl.debug('retaining original binding operation failure', error);
        completed.failure = Object.freeze({ cause: error });
      }
    }
    try {
      trace('binding-segment.postcheck');
      ready();
    }
    catch (error) {
      bl.debug('retaining original binding postcheck failure', error);
      retained.eligibilityFailure ??= Object.freeze({ cause: error });
      if (completed.failure) throw new AggregateError([completed.failure.cause, error], 'Original binding operation and postcheck failed');
      throw error;
    }
    if (completed.failure) throw completed.failure.cause;
    return nonNullishOrThrow(completed.outcome).value;
  }
  return bindingSegment;
}
//endregion
