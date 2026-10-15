/**
 Original judgment dependency eligibility remains permanent after observation failure. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { nonNullishOrThrow } from '@monochromatic-dev/module-or-throw/ts';
import { JudgmentConstructionError } from './judgment-error.ts';
import { createJudgmentBindingSegment } from './judgment-binding-segment.ts';
import type {
  JudgmentDependencyInput,
  JudgmentDependencyRetained,
  JudgmentDependencyChecks
} from './judgment-dependency-types.ts';

/**
 Dependency diagnostics never contain original source content.
 */
const l = tagged({ tag: 'auto-mode-judgment-dependencies' });

//region Live and retained dependency checks share one original eligibility lifetime.
/**
 Bind original request, budget, prepared programs, and dependency observations to permanent eligibility.

 @param input - original currentness capabilities and shared preparation reader

 @returns frozen original currentness and binding operations

 @example createJudgmentDependencyChecks(input);
 */
export function createJudgmentDependencyChecks(input: JudgmentDependencyInput): JudgmentDependencyChecks {
  /**
   Factory diagnostics do not invoke any original external observation.
   */
  const rl = tagged({
    tag: createJudgmentDependencyChecks.name,
    l
  });
  rl.debug('binding original judgment dependency checks');
  /**
   Original owners retain declaration order and callback identity.
   */
  const {
    budget,
    readOriginalRequest,
    receipt,
    facade,
    byMember,
    bindings,
    trace,
    readPreparation
  } = input;
  /**
   No failure exists before the original dependency boundary observes one.
   */
  const retained: JudgmentDependencyRetained = { bindingSegmentActive: false };
  /**
   Revalidate every original prepared program after an external dependency read.
   */
  function assertPreparedProgramDependencies(): void {
    for (const member of byMember.values()) nonNullishOrThrow(bindings.get(member))
      .preparedProgram
      ?.assertCurrent();
  }
  /**
   Preserve the first failed dependency observation for every subsequent operation.

   @param read - original external dependency observation

   @returns unchanged observation result after prepared program checks
   */
  function dependencyCheck<Result>(read: () => Result): Result {
    /**
     Each dependency boundary reports retained failures without serializing source values.
     */
    const dl = tagged({
      tag: dependencyCheck.name,
      l: rl
    });
    try {
      /**
       Internal binding reads skip prepared program callbacks until the segment releases.
       */
      const value = read();
      if (!retained.bindingSegmentActive) assertPreparedProgramDependencies();
      return value;
    }
    catch (error) {
      dl.debug('retaining original dependency observation failure');
      retained.eligibilityFailure ??= Object.freeze({ cause: error });
      throw error;
    }
  }
  /**
   Reject retired evidence before invoking any external observer.

   @throws JudgmentConstructionError when original dependency eligibility has ended
   */
  function assertEligible(): void {
    if (retained.eligibilityFailure) throw new JudgmentConstructionError(
      'Original relation evidence lost dependency eligibility',
      { cause: retained.eligibilityFailure
        .cause }
    );
  }
  /**
   Authenticate current decision phase and original request within its original budget.

   @throws JudgmentConstructionError when original preparation, finalization, or request identity has ended
   */
  function active(): void {
    assertEligible();
    /**
     Original closure failure takes precedence over preparation failure and completion.
     */
    const state = readPreparation();
    if (state.closeFailed) throw new JudgmentConstructionError(
      'Judgment finalization failed permanently',
      { cause: nonNullishOrThrow(state.finalRecord)
        .failure }
    );
    if (state.preparationFailed) throw new JudgmentConstructionError(
      'Judgment preparation failed permanently',
      { cause: state.preparationFailure }
    );
    if (state.finished) throw new JudgmentConstructionError('Judgment evidence collection is finished');
    dependencyCheck(function checkOriginalRequest() {
      budget.checkpoint();
      if ((!retained.bindingSegmentActive) && (readOriginalRequest() !== receipt)) throw new JudgmentConstructionError('Enclosing request observation changed');
    });
  }
  /**
   Require complete original membership after authenticating the current request.

   @throws JudgmentConstructionError when final prepared membership is unavailable
   */
  function ready(): void {
    active();
    if (!readPreparation()
      .prepared) throw new JudgmentConstructionError('Complete final prepared membership is unavailable');
    dependencyCheck(function finalizePreparedDependencies() {
      if (!retained.bindingSegmentActive) facade.finalize(readPreparation()
        .handle);
      budget.checkpoint();
    });
  }
  /**
   Keep retained dependency freshness separate from decision time and permission.

   @returns original live or retained dependency projection

   @throws JudgmentConstructionError when failed closure, missing preparation, or request replacement prevents release
   */
  function assertDependenciesCurrent(): unknown {
    assertEligible();
    /**
     Dependency release reads current closure before choosing live versus retained checks.
     */
    const state = readPreparation();
    if (state.closeFailed) throw new JudgmentConstructionError('Failed finalization cannot release dependencies');
    if ((!state.prepared) || state.preparationFailed) throw new JudgmentConstructionError('Judgment has no prepared dependency handle');
    return dependencyCheck(function checkOriginalDependencies() {
      if (!readPreparation()
        .finished) {
        active();
        return facade.finalize(readPreparation()
          .handle);
      }
      if (readOriginalRequest() !== receipt) throw new JudgmentConstructionError('Enclosing request observation changed');
      return facade.checkRetained(readPreparation()
        .handle);
    });
  }
  /**
   Original segment lifetime shares the same permanent dependency failure state.
   */
  const bindingSegment = createJudgmentBindingSegment({
    retained,
    ready,
    trace
  });
  return Object.freeze({
    active,
    ready,
    dependencyCheck,
    bindingSegment,
    assertDependenciesCurrent,
    isBindingSegmentActive() { 
      return retained.bindingSegmentActive; 
    },
  });
}
//endregion
