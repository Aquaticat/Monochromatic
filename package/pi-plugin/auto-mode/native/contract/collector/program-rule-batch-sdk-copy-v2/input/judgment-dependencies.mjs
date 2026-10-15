import { readMainAgentRequest } from '../../request-producer-group-consumer/request.mjs';
import { JudgmentConstructionError } from './judgment-input.mjs';

//region Dependency eligibility and synchronous binding boundaries share one judgment lifetime.
/** Keep freshness failures permanent while retaining the original preparation and closure owner. */
export function createJudgmentDependencyChecks({
  budget, input, receipt, facade, byMember, bindings, trace, readPreparation
}) {
  const retained = { eligibilityFailure: undefined, bindingSegmentActive: false };

  /** Revalidate every original prepared program after an external dependency read. */
  function assertPreparedProgramDependencies() {
    for (const member of byMember.values()) {
      bindings.get(member).preparedProgram?.assertCurrent();
    }
  }

  /** Preserve the first failed dependency observation for every subsequent operation. */
  function dependencyCheck(read) {
    try {
      const value = read();
      if (!retained.bindingSegmentActive) assertPreparedProgramDependencies();
      return value;
    } catch (error) {
      retained.eligibilityFailure ??= Object.freeze({ cause: error });
      throw error;
    }
  }

  /** Reject retired evidence before invoking an external observer. */
  function assertEligible() {
    if (retained.eligibilityFailure) {
      throw new JudgmentConstructionError('Original relation evidence lost dependency eligibility', {
        cause: retained.eligibilityFailure.cause
      });
    }
  }

  /** Authenticate the current decision phase and original request within its original budget. */
  function active() {
    assertEligible();
    const state = readPreparation();
    if (state.closeFailed) {
      throw new JudgmentConstructionError('Judgment finalization failed permanently', { cause: state.finalRecord.failure });
    }
    if (state.preparationFailed) {
      throw new JudgmentConstructionError('Judgment preparation failed permanently', { cause: state.preparationFailure });
    }
    if (state.finished) throw new JudgmentConstructionError('Judgment evidence collection is finished');
    dependencyCheck(function checkOriginalRequest() {
      budget.checkpoint();
      if (!retained.bindingSegmentActive && readMainAgentRequest(input) !== receipt) {
        throw new JudgmentConstructionError('Enclosing request observation changed');
      }
    });
  }

  /** Require complete membership after the current request has been authenticated. */
  function ready() {
    active();
    if (!readPreparation().prepared) {
      throw new JudgmentConstructionError('Complete final prepared membership is unavailable');
    }
    dependencyCheck(function finalizePreparedDependencies() {
      if (!retained.bindingSegmentActive) facade.finalize(readPreparation().handle);
      budget.checkpoint();
    });
  }

  /** Bound internal identity reads with fresh external checks before and after the operation. */
  function bindingSegment(run) {
    if (retained.bindingSegmentActive) throw new JudgmentConstructionError('Original binding segments cannot nest');
    // All external identity/phase authentication precedes this internal boundary.
    ready();
    const completed = { value: undefined, failure: undefined };
    {
      retained.bindingSegmentActive = true;
      using segment = { [Symbol.dispose]() { retained.bindingSegmentActive = false; } };
      try { completed.value = run(); }
      catch (error) { completed.failure = Object.freeze({ cause: error }); }
    }
    // No cached freshness remains while observers and diagnostic callbacks run.
    try { trace('binding-segment.postcheck'); ready(); }
    catch (error) {
      retained.eligibilityFailure ??= Object.freeze({ cause: error });
      if (completed.failure) {
        throw new AggregateError([completed.failure.cause, error], 'Original binding operation and postcheck failed');
      }
      throw error;
    }
    if (completed.failure) throw completed.failure.cause;
    return completed.value;
  }

  /** Native release keeps freshness separate from decision time and never authorizes an effect. */
  function assertDependenciesCurrent() {
    assertEligible();
    const state = readPreparation();
    if (state.closeFailed) throw new JudgmentConstructionError('Failed finalization cannot release dependencies');
    if (!state.prepared || state.preparationFailed) {
      throw new JudgmentConstructionError('Judgment has no prepared dependency handle');
    }
    return dependencyCheck(function checkOriginalDependencies() {
      if (!readPreparation().finished) {
        // active authenticates the original request after checking the live decision budget.
        active();
        return facade.finalize(readPreparation().handle);
      }
      if (readMainAgentRequest(input) !== receipt) {
        throw new JudgmentConstructionError('Enclosing request observation changed');
      }
      return facade.checkRetained(readPreparation().handle);
    });
  }

  return Object.freeze({
    active, ready, dependencyCheck, bindingSegment, assertDependenciesCurrent,
    isBindingSegmentActive() { return retained.bindingSegmentActive; }
  });
}
//endregion
