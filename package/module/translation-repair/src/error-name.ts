//region Error name
// Names what a thrown value IS, without asserting it into a shape.
//
// A CATCH BINDING IS `unknown`, and asserting it to `Error` is a claim about
// something nobody checked. Anything at all can be thrown, and the one occasion
// this matters is the one occasion the report is worth reading.
//
// LIFTED OUT OF FOUR COPIES on 2026-08-24: whole functions in
// `verify-published.ts` and `anthropic-delta-scan.ts`, and the same ternary
// written inline in `provider-budget.ts` and `producer-calibrate.ts`. A fifth
// caller was about to be written, which is the point at which duplication
// stops being incidental.

/**
 * Stand-in for a thrown value that carries no class name.
 *
 * Phrased as a sentence rather than as a token, because it lands in a log line
 * where a reader is already asking what went wrong and a bare `unknown` answers
 * nothing.
 */
const NAMELESS_THROW = 'a thrown value that is not an Error';

/**
 * Names the class of whatever was caught.
 *
 * @param error - caught value, of unknown type by construction
 *
 * @returns Class name, or a stand-in for a value that has none
 *
 * @example
 * ```ts
 * console.error(errorName({ error, },),);
 * ```
 */
export function errorName(
  { error, }: { readonly error: unknown; },
): string {
  if (Error.isError(error,))
    return error.name;
  return NAMELESS_THROW;
}

//endregion Error name
