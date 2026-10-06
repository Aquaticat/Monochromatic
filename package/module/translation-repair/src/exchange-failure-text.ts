import { SyntheticHttpError, } from './completion-shape.ts';
import {
  namesWithoutQuoting,
  refusalText,
} from './refusal-text.ts';
import { rendersAsNothing, } from './renders-as-nothing.ts';
import { jsonLine, } from './resolution-sheet-evidence.ts';

//region Exchange failure text
// Renders what a model exchange threw for a stored record, a finding or a thrown message,
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
 const detail = exchangeFailureText({ error, },);
 ```
 */
export function exchangeFailureText(
  { error, }: { readonly error: unknown; },
): string {
  if (namesWithoutQuoting(error,) || (!(error instanceof SyntheticHttpError)))
    return refusalText({ error, },);

  return `${refusalText({ error, },)} with HTTP ${String(error.status,)}`;
}

//region Exchange failure log text
// For LOG LINES ALONE: what `exchangeFailureText` says, and the provider's own
// words where the failure is a provider status failure.
//
// WHY THIS IS NOT "A CAUGHT VALUE TURNED INTO TEXT WHOLE". The words come from
// the typed field `bodyExcerpt` of a class this package constructs, never from
// a caught value's message or stack. That field is bounded where it is built
// (`BODY_EXCERPT_LIMIT` units, ending on a whole character), holds the opening
// of a reply body the transport has already masked of every credential the
// request carried, and is read here only after an `instanceof` check on the
// class. The provider's reason for refusing one request and not another is the
// only evidence an operator has for dropping a model, and it reaches no other
// text: a stored record or a thrown message keeps `exchangeFailureText`.

/**
 Renders a failure a model exchange raised for a log line: its text and, for a
 provider status failure, the provider's own words labelled as the provider's.

 @param error - caught value, of unknown type by construction

 @returns What `exchangeFailureText` returns, followed by
 `(the provider said: "<words>")` for any `SyntheticHttpError`, marked or
 not, whose excerpt is not blank

 @example
 ```ts
 l.warn(`${stage} ${modelId}: ${exchangeFailureLogText({ error, },)}, voice lost`,);
 ```
 */
export function exchangeFailureLogText(
  { error, }: { readonly error: unknown; },
): string {
  /**
   What a stored record would say.
   */
  const plain = exchangeFailureText({ error, },);
  if (!(error instanceof SyntheticHttpError))
    return plain;

  /**
   The provider's words, bounded where the error was built.
   */
  const { bodyExcerpt, } = error;
  if (rendersAsNothing({ text: bodyExcerpt, },))
    return plain;

  /**
   The provider's words, quoted onto one line.
   */
  const said = jsonLine({ text: bodyExcerpt, },);
  return `${plain} (the provider said: ${said})`;
}

//endregion Exchange failure log text
