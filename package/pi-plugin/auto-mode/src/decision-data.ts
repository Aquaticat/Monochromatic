/**
 Validate decoded Decisions wire data without admitting semantic evidence.

 @module
 */
import { tagged, } from '@monochromatic-dev/module-logger/ts';

/**
 Invalid wire data never retains provider content in its diagnostic.
 */
export class DecisionWireError extends Error {
  /**
   Distinguish conversion failures from original policy uncertainty.
   */
  override readonly name = 'DecisionWireError';
}

/**
 Wire diagnostics contain lifecycle information only.
 */
const l = tagged({ tag: 'auto-mode-decision-data', },);

//region Decoded JSON remains untrusted until its consumer checks each field

/**
 Parse JSON without exposing its text in syntax diagnostics.

 @param text - complete bounded request or response

 @returns decoded data requiring domain validation

 @throws DecisionWireError for invalid JSON
 */
export function parseDecisionJson(text: string,): unknown {
  /**
   The diagnostic deliberately excludes input and parser error messages.
   */
  const rl = tagged({ tag: parseDecisionJson.name, l, },);
  rl.debug('parsing bounded Decisions JSON',);
  try {
    return JSON.parse(text,);
  }
  catch (error) {
    if (!(error instanceof SyntaxError)) throw error;
    rl.debug('Decisions JSON parsing failed',);
    throw new DecisionWireError('Assessment wire contains invalid JSON',);
  }
}

/**
 Read an ordinary decoded JSON object without narrowing its contained values.

 @param value - decoded JSON value

 @returns original record for field-specific validation

 @throws DecisionWireError for non-object data
 */
export function decisionRecord(value: unknown,): Readonly<Record<string, unknown>> {
  tagged({ tag: decisionRecord.name, l, },).debug('checking decoded Decisions record',);
  if ((value === null) || ((typeof value) !== 'object') || Array.isArray(value,)
    || (Object.getPrototypeOf(value,) !== Object.prototype))
    throw new DecisionWireError('Assessment wire requires a JSON object',);
  return value as Readonly<Record<string, unknown>>;
}

/**
 Preserve supplied numbers without rounding or normalization.

 @param value - decoded probability or confidence

 @returns finite original score within the API interval

 @throws DecisionWireError for an invalid number
 */
export function decisionProbability(value: unknown,): number {
  tagged({ tag: decisionProbability.name, l, },).debug('checking Decisions score bounds',);
  if (((typeof value) !== 'number') || (!Number.isFinite(value,)) || (value < 0) || (value > 1))
    throw new DecisionWireError('Assessment answer requires finite scores between zero and one',);
  return value;
}

//endregion Decoded JSON validation
