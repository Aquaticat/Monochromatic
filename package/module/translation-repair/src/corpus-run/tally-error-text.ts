import { refusalText, } from '../refusal-text.ts';
import { wholeOpening, } from '../code-points.ts';

//region Tally error text
// FAILURE TEXT FOR A STDOUT LINE. A class that declared its message quote-free
// says it, anything else is named and not quoted, since stdout is read,
// grepped, and pasted; capped after that so one runaway message
// cannot swallow the line a reader counts by.

/**
 Most UTF-16 units of an error message kept in a `TALLY` or `CLEANUP` line;
 the cut ends on a whole character (`wholeOpening`).
 */
export const TALLY_ERROR_CAP = 200;

/**
 Renders a caught value for a stdout line, named or quoted per its class and
 capped.

 @param error - what was caught

 @returns Text safe to print on a line a reader greps

 @example
 ```ts
 console.log(`TALLY ${id} status=ERROR error=${tallyErrorText({ error, },)}`,);
 ```
 */
export function tallyErrorText({ error, }: { readonly error: unknown; },): string {
  return wholeOpening({
    text: refusalText({ error, },),
    units: TALLY_ERROR_CAP,
  },);
}

//endregion Tally error text
