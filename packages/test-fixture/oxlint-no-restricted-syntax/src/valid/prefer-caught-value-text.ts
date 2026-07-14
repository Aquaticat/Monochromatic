// Fixture: shared formatter calls and nonformatting Error checks remain valid.

import {
  caughtValueStack,
  caughtValueText,
} from '@monochromatic-dev/module-caught-value/ts';

/** Uses shared message formatter. */
function message(error: unknown,): string {
  return caughtValueText(error,);
}

/** Uses shared stack formatter. */
function stack(error: unknown,): string {
  return caughtValueStack(error,);
}

/** Uses Error.isError only as a predicate. */
function isError(error: unknown,): boolean {
  return Error.isError(error,);
}

message('failure',);
stack('failure',);
isError('failure',);
