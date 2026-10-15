/**
 Original synchronous public guards preserve callback identity and argument cardinality. @module
 */
import type { JudgmentLifecycle } from './judgment-lifecycle-types.ts';

//region Guard wrappers retain original operation ownership without adding validation.
/**
 Retain exactly one argument even when callers omit it or pass extra arguments.

 @param operation - original synchronous exclusion boundary

 @param run - original one-input owner

 @returns original synchronous operation wrapper

 @example guardWithInput({ operation, run });
 */
export function guardWithInput<Input, Result>({
  operation,
  run
}: Readonly<{
  operation: JudgmentLifecycle['operation'];
  run: (input: Input) => Result;
}>): (input: Input) => Result {
  return function invokeJudgmentOperation(input: Input): Result {
    return operation(function runBoundJudgmentOperation() {
      return run(input);
    });
  };
}

/**
 Preserve the no-input owner's identity when handing it to the original guard.

 @param operation - original synchronous exclusion boundary

 @param run - original no-input owner

 @returns original synchronous operation wrapper

 @example guardWithoutInput({ operation, run });
 */
export function guardWithoutInput<Result>({
  operation,
  run
}: Readonly<{
  operation: JudgmentLifecycle['operation'];
  run: () => Result;
}>): () => Result {
  return function invokeJudgmentOperation(): Result {
    return operation(run);
  };
}
//endregion
