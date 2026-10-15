/**
 Disposable original judgment clocks and transport failure capture.
 @module
 */
import {
  nativeBudget,
  type NativeBudget
} from './native-judgment-budget-module-fixture.ts';

//region Each test owns its clock, cancellation and budget independently.
/**
 Controlled lifetime behind a built original judgment.
 */
type BudgetFixture = {
  /**
   Original built budget consumer.
   */
  readonly budget: NativeBudget;
  /**
   Test-owned monotonic clock input.
   */
  readonly clock: {at: number};
  /**
   Original caller cancellation.
   */
  readonly controller: AbortController;
};

/**
 Default failures are not eligible for another transport invocation.
 
 @returns fixed refusal to retry
 */
function noRetry(): boolean {
  return false;
}

/**
 Create an independent original lifetime for each consumer test.
 
 @param classify - fixed classification of actual transport failures
 
 @returns owned clock, cancellation and built budget
 
 @example
 ```ts
 const fixture = createBudgetFixture();
 fixture.budget.checkpoint();
 ```
 */
export function createBudgetFixture({classify=noRetry}: {
  readonly classify?: (error: unknown) => boolean;
}={}): BudgetFixture {
  /**
   Initial time is deterministic and advances only when this test requests it.
   */
  const clock={at:0};
  /**
   Every budget receives its original independent cancellation signal.
   */
  const controller=new AbortController();
  /**
   Import the artifact's implementation, so tests cannot bypass native packaging.
   */
  const budget=nativeBudget.createJudgmentBudget({
    now:function readClock() { return clock.at; },
    signal:controller.signal,
    isRetryableTransportFailure:classify
  });
  return {
    budget,
    clock,
    controller
  };
}

/**
 Preserve a rejected original value for assertions after the operation settles.
 
 @param operation - started original operation whose rejection is expected
 
 @returns original rejected value
 
 @example
 ```ts
 const error = await captureBudgetRejection(budget.dispatch(failedTransport));
 ```
 */
export async function captureBudgetRejection(operation: Promise<unknown>): Promise<unknown> {
  try {
    await operation;
  } catch(error) {
    return error;
  }
  throw new Error('Expected original budget operation to reject');
}
//endregion
