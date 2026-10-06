import { SyntheticHttpError, } from './completion-shape.ts';
import {
  namesWithoutQuoting,
  refusalText,
} from './refusal-text.ts';

//region Exchange failure text
// Renders what a model exchange threw for a log line or a stored finding,
// quoting nothing the provider or the runtime wrote.
//
// WHY NOT `refusalText` ALONE. `SyntheticHttpError` carries an excerpt of the
// provider's response body in its message on purpose, so it is unmarked and
// `refusalText` names its class and drops the HTTP status with the body. The
// status is the one diagnostic an operator reads a lost voice by (a 429 and a
// 400 call for different action), and it is a number the transport computed,
// so it is added here beside the class name.

/**
 Renders a failure a model exchange raised, quoting no message of its own.

 @param error - caught value, of unknown type by construction

 @returns A marked class's own sentence, `refused by <class> with HTTP <status>` for an unmarked
 provider status failure, and the class name alone for anything else

 @example
 ```ts
 l.warn(`${stage} ${modelId}: ${exchangeFailureText({ error, },)}, voice lost`,);
 ```
 */
export function exchangeFailureText(
  { error, }: { readonly error: unknown; },
): string {
  if (namesWithoutQuoting(error,) || (!(error instanceof SyntheticHttpError)))
    return refusalText({ error, },);

  return `${refusalText({ error, },)} with HTTP ${String(error.status,)}`;
}

//endregion Exchange failure text
