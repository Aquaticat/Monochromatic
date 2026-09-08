import { tagged, } from '@monochromatic-dev/module-logger/ts';

import { parseModelJson, } from './model-content.ts';

//region Json false start
// THE SEVENTEENTH CLASS, found by the tenth hakureico pass on 2026-09-08 and
// read back through the ninth: a reasoning stream sometimes opens its answer,
// abandons the opening, and then writes the whole object after it, so the
// answer channel reads `{"best": 1{"best": 1, "reason": ...}`,
// `{"{"resolution": ...}`, `{ {   "choice": ...}` or
// `{   "issues":{     "issues": [...]}`. Bedrock's gpt-oss-120b did it on six
// of the ninth pass's eight mismatches; OpenRouter's Makora route for
// deepseek-v4-flash-0731 did it on every mismatch of the tenth; every one of
// those streams carried reasoning characters, and no stream without them did.
// The object after the fragment is the model's answer, so it is read and the
// fragment's length is logged, where before the voice was lost.

/**
 * Logger root for the false-start reader.
 */
const l = tagged({ tag: 'translation-repair', },);

/**
 * Characters of the answer within which an abandoned opening may sit.
 * The longest observed was 13 (`{   "issues":`); a fragment longer than
 * this window is not an opening but some other defect.
 */
export const FALSE_START_WINDOW = 256;

/**
 * Reads a JSON object that follows an abandoned opening fragment.
 *
 * Each `{` inside the window, after the first character, is tried as the
 * object's start until one parses to the end of the text; the first that
 * does is the answer. Bounded by the window, so a long reply costs at most
 * as many parses as it has braces in its first characters, and each parse
 * is one linear pass.
 *
 * @param text - answer channel that failed to parse as a whole
 *
 * @returns Parsed value with the abandoned length, or nothing to read past
 *
 * @example
 * ```ts
 * const past = readJsonPastFalseStart({ text: '{"best": 1{"best": 1}', },);
 * ```
 */
export function readJsonPastFalseStart({ text, }: { readonly text: string; },):
  | {
    readonly parsed: true;
    readonly value: unknown;
    readonly abandoned: number;
  }
  | { readonly parsed: false; }
{
  /**
   * Logger pre-tagged with this function's name.
   */
  const rl = tagged({
    tag: readJsonPastFalseStart.name,
    l,
  },);

  /**
   * Answer with its leading whitespace dropped, to see what it opens with.
   */
  const opening = text.trimStart();

  if (!opening.startsWith('{',)) {
    rl.debug('answer does not open an object, so there is no false start to read past',);
    return { parsed: false, };
  }

  /**
   * Index past which no object start is tried.
   */
  const last = Math.min(
    text.length,
    FALSE_START_WINDOW,
  );

  // One counter pass over the window; only a brace is tried as a start.
  for (let at = 1; at < last; at += 1) {
    if (text[at] !== '{')
      continue;
    try {
      /**
       * Value the remainder parses to, when it does.
       */
      const value: unknown = JSON.parse(text.slice(at,),);
      rl.debug(`read an object past an abandoned opening of ${String(at,)} chars`,);
      return {
        parsed: true,
        value,
        abandoned: at,
      };
    }
    catch (error) {
      rl.debug(`no object starts at ${String(at,)}: ${String(error,)}`,);
    }
  }

  return { parsed: false, };
}

/**
 * Parses an answer as a whole, and past a false start when the whole fails.
 *
 * @param text - fence-stripped answer channel
 *
 * @returns Parsed value with the abandoned length (zero for a whole parse), or failure detail
 *
 * @example
 * ```ts
 * const attempt = parseAnswerJson({ text: unwrapped, },);
 * ```
 */
export function parseAnswerJson({ text, }: { readonly text: string; },):
  | {
    readonly parsed: true;
    readonly value: unknown;
    readonly abandoned: number;
  }
  | {
    readonly parsed: false;
    readonly detail: string;
  }
{
  /**
   * Parse of the whole answer, the ordinary case.
   */
  const whole = parseModelJson({ text, },);

  if (whole.parsed) {
    return {
      parsed: true,
      value: whole.value,
      abandoned: 0,
    };
  }

  /**
   * Reading past an abandoned opening, when there is one.
   */
  const past = readJsonPastFalseStart({ text, },);

  return past.parsed ? past : whole;
}

//endregion Json false start
