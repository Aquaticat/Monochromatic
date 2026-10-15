/**
 Authenticate original handles and serialize judgment-local binding operations. @module
 */
import { tagged } from '@monochromatic-dev/module-logger/ts';
import { QuestionSelectionError } from './selection-error.ts';
import { object } from './selection-values.ts';
import type {
  QuestionBinding,
  QuestionSelectionInput,
  SelectionBatch,
  SelectionClaim,
  SelectionOwner,
} from './selection-owner-types.ts';

/**
 Ownership diagnostics avoid exposing original projections.
 */
const l = tagged({ tag: 'auto-mode-question-ownership' });

/**
 Admit the original record without normalizing or copying its identity.
 
 @param binding - resolver output awaiting structural admission
 
 @returns assertion preserving the original occurrence record
 
 @throws QuestionSelectionError for mutable or incomplete resolver output
 */
function assertQuestionBinding(binding: unknown): asserts binding is QuestionBinding {
  if ((!object(binding)) || (!Object.isFrozen(binding))
    || (!object(binding.identity))
    || (!Object.isFrozen(binding.identity))
    || (!Object.hasOwn(
      binding,
      'projection'
    ))) throw new QuestionSelectionError('Binding resolver did not return an immutable owned occurrence');
}

//region One retained lock covers every handle read and publication operation.
/**
 Create owner-local membership and binding-currentness capabilities.

 @param budget - enclosing judgment retains the original deadline

 @param resolveBinding - trusted resolver returns the original immutable occurrence

 @returns private membership indexes and synchronous owner operations

 @example
 ```ts
 const owner = createSelectionOwner({ budget, resolveBinding });
 ```
 */
export function createSelectionOwner({
  budget,
  resolveBinding
}: Pick<QuestionSelectionInput, 'budget' | 'resolveBinding'>): SelectionOwner {
  /**
   Each owner has an independent diagnostic scope.
   */
  const sl = tagged({
    tag: createSelectionOwner.name,
    l
  });
  sl.debug('creating original question owner');
  /**
   Only this owner's declarations can populate the claim index.
   */
  const claims = new WeakMap<object, SelectionClaim>();
  /**
   Only this owner's issuance can populate the batch index.
   */
  const batches = new WeakMap<object, SelectionBatch>();
  /**
   Counts and reentry protection belong to the complete judgment lifetime.
   */
  const state = {
    batchCount: 0,
    declaredCount: 0,
    locked: false
  };
  /**
   Hold the original synchronous lock even when callbacks throw.
   
   @param operation - owner operation executed without reentry
   
   @returns original operation result
   
   @throws QuestionSelectionError for reentrant binding operations
   */
  function retainedOperation<Result>(operation: () => Result): Result {
    if (state.locked) throw new QuestionSelectionError('Question binding operations cannot reenter');
    state.locked = true;
    /**
     Every exit restores the original owner's ability to inspect or retain state.
     */
    using selectionScope = {
      [Symbol.dispose](): void { state.locked = false; }
    };
    return operation();
  }
  /**
   Check lifetime inside the original lock before reading current state.
   
   @param operation - current owner operation
   
   @returns original operation result
   */
  function atomic<Result>(operation: () => Result): Result {
    return retainedOperation(function runWithinQuestionBudget(): Result {
      budget.checkpoint();
      return operation();
    });
  }
  /**
   Admit the exact resolver record without copying its occurrence identity.
   
   @param handle - enclosing owner's occurrence handle
   
   @returns original immutable occurrence record
   
   @throws QuestionSelectionError for invalid resolver output
   */
  function resolve(handle: unknown): QuestionBinding {
    /**
     The trusted resolver still crosses a runtime structural boundary.
     */
    const binding = resolveBinding(handle);
    assertQuestionBinding(binding);
    return binding;
  }
  /**
   Authenticate original claim membership before reading retained state.
   
   @param handle - untrusted claim handle
   
   @returns original owner-local claim
   
   @throws QuestionSelectionError for foreign handles
   */
  function knownClaim(handle: unknown): SelectionClaim {
    /**
     Primitive and foreign handles have no original membership.
     */
    const claim = object(handle) ? claims.get(handle) : undefined;
    if (!claim) throw new QuestionSelectionError('Claim handle is not owned by this judgment');
    return claim;
  }
  /**
   Reject a changed occurrence even if the resolver reuses its identity.
   
   @param claim - original retained claim
   
   @throws QuestionSelectionError for changed binding records
   */
  function current(claim: SelectionClaim): void {
    if (resolve(claim.bindingHandle) !== claim.binding) throw new QuestionSelectionError('Claim binding changed; the original judgment must not silently rebind');
  }
  /**
   Authenticate original batch membership before dispatch or retention.
   
   @param handle - untrusted batch handle
   
   @returns original owner-local batch
   
   @throws QuestionSelectionError for foreign handles
   */
  function knownBatch(handle: unknown): SelectionBatch {
    /**
     Primitive and foreign handles have no issued membership.
     */
    const batch = object(handle) ? batches.get(handle) : undefined;
    if (!batch) throw new QuestionSelectionError('Question batch is not owned by this judgment');
    return batch;
  }
  return {
    claims,
    batches,
    state,
    resolve,
    knownClaim,
    knownBatch,
    current,
    retainedOperation,
    atomic,
    budget
  };
}
//endregion
