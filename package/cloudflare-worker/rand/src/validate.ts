/**
 Strict input validation.

 Every refusal is a 400 that names the offending input and the domain that
 would have been accepted, and never a 500: a bad request is the caller's
 error, not a server fault. This is the deliberate difference from the Caddy
 original this Worker replaces, whose template functions could only coerce.
 There, `atoi` turned `abc` into zero, and duplicate query parameters
 collapsed into one unparseable string that also became zero, so
 `min=0&max=2&max=6` answered a constant zero with status 200. Both now answer
 400.

 @module
 */

import {
  BadRequestError,
  NotFoundError,
} from './errors.ts';
import { MAX_RANDOM_LENGTH, } from './random.ts';

//region Constants

/**
 Punctuation that makes a path segment look like an attempted number.

 Chosen so a malformed length answers 400 with the valid range, while a
 segment that was never numeric answers 404 as an unknown route.
 */
const NUMERIC_PUNCTUATION = '+-.eE';

/**
 Query parameter names the `/int` route reads.
 */
const INT_PARAMETER_NAMES = [
  'min',
  'max',
] as const;

//endregion Constants

//region Helpers

/**
 Whether `text` looks like an attempted number.

 True when every character is a decimal digit or appears in
 {@link NUMERIC_PUNCTUATION} and at least one digit is present, so `1.5`, `-1`,
 `007` and `1e3` all count, while `1a` and `nope` do not.

 @param text - path segment to classify

 @returns whether the segment reads as a number attempt

 @example
 ```ts
 looksNumeric('007'); // true, and parseCanonicalInteger then refuses it
 looksNumeric('nope'); // false, so the route answers 404
 ```
 */
export function looksNumeric(text: string,): boolean {
  /**
   Whether a digit has been seen, so punctuation alone does not count.
   */
  let sawDigit = false;
  for (const character of text) {
    if ((character >= '0') && (character <= '9')) {
      sawDigit = true;
      continue;
    }
    if (!NUMERIC_PUNCTUATION.includes(character,)) {
      return false;
    }
  }
  return sawDigit;
}

/**
 Body of the 404 for a path that matches no route.

 Lists what is served so the response documents the API instead of
 dead-ending, and names the path so the caller can see what was matched
 against.

 @param pathname - path that matched nothing

 @returns plain-text 404 body
 */
function noRouteMessage(pathname: string,): string {
  return `no route matches "${pathname}"; served routes are /uuidv4, /int?min=&max=, /1 to /${String(MAX_RANDOM_LENGTH)}, and / for ${String(MAX_RANDOM_LENGTH)} characters`;
}

/**
 Parse a canonical decimal integer.

 Canonical means an optional leading minus sign, then either a single zero or
 a nonzero digit followed by more digits. So `+5`, ` 1`, `007`, `-0`, `1.5`,
 `0x10` and `1e3` are all refused rather than coerced, which is what the Caddy
 original could not do. Magnitudes beyond the safe integer range are refused
 too, instead of being clamped the way the origin's overflow behaved.

 Scans characters rather than matching a pattern, so the cost is one pass over
 the input with no backtracking.

 @param text - raw text to parse

 @param label - how the refusal should name this input, so the caller learns
   which field failed

 @returns parsed integer, within the safe integer range

 @throws BadRequestError when `text` is empty, signed zero, carries a leading
   zero, contains a non-digit, or exceeds the safe integer range

 @example
 ```ts
 parseCanonicalInteger({
   text: '-3',
   label: 'query parameter "min"',
 },); // -3
 ```
 */
export function parseCanonicalInteger({
  text,
  label,
}: ParseCanonicalIntegerParams,): number {
  /**
   Whether a leading minus sign was present.
   */
  const negative = text.startsWith('-');
  /**
   Digit run with any sign removed.
   */
  const digits = negative ? text.slice(1,) : text;
  if (digits === '') {
    throw new BadRequestError(`${label} must be a decimal integer, but it is empty`,);
  }
  if ((digits.startsWith('0')) && (digits.length > 1)) {
    throw new BadRequestError(`${label} must not carry a leading zero, got "${text}"`,);
  }
  for (const character of digits) {
    if ((character < '0') || (character > '9')) {
      throw new BadRequestError(`${label} must contain only decimal digits, got "${text}"`,);
    }
  }
  /**
   Numeric value of the validated digit run.
   */
  const value = Number(text,);
  if (!Number.isSafeInteger(value,)) {
    throw new BadRequestError(`${label} must be an integer between -${String(Number.MAX_SAFE_INTEGER)} and ${String(Number.MAX_SAFE_INTEGER)}, got "${text}"`,);
  }
  if (negative && (value === 0)) {
    throw new BadRequestError(`${label} must not be negative zero, got "${text}"`,);
  }
  return value;
}

/**
 Parameters for {@link parseCanonicalInteger}.
 */
export type ParseCanonicalIntegerParams = {
  /**
   Raw text to parse.
   */
  readonly text: string;
  /**
   How a refusal should name this input, so the 400 tells the caller which
   field failed.
   */
  readonly label: string;
};

/**
 Read one required canonical integer query parameter.

 @param searchParams - parsed query of the inbound request

 @param name - parameter to read

 @returns parsed integer

 @throws BadRequestError when the parameter is absent or non-canonical
 */
function requiredInteger({
  searchParams,
  name,
}: RequiredIntegerParams,): number {
  /**
   Raw text for this parameter; duplicates are refused before this runs, so
   the first value is the only value.
   */
  const raw = searchParams.get(name,);
  if (raw === null) {
    throw new BadRequestError(`query parameter "${name}" is required`,);
  }
  return parseCanonicalInteger({
    text: raw,
    label: `query parameter "${name}"`,
  },);
}

/**
 Parameters for {@link requiredInteger}.
 */
type RequiredIntegerParams = {
  /**
   Parsed query of the inbound request.
   */
  readonly searchParams: URLSearchParams;
  /**
   Parameter to read.
   */
  readonly name: string;
};

//endregion Helpers

//region Routes

/**
 Bounds the `/int` route draws between, both included.
 */
export type IntBounds = {
  /**
   Lower bound, included in the result.
   */
  readonly min: number;
  /**
   Upper bound, included in the result.
   */
  readonly max: number;
};

/**
 Parameters for {@link parseIntParams}.
 */
export type ParseIntParamsParams = {
  /**
   Parsed query of the inbound request.
   */
  readonly searchParams: URLSearchParams;
};

/**
 Validate the `/int` query into inclusive bounds.

 Refuses a repeated parameter outright, because the Caddy original silently
 turned the repetition into one unparseable string and so into zero. Names are
 matched case-sensitively, as the origin did, so `MIN` is an unrecognized
 parameter rather than an alias. Unknown extra parameters are ignored, since
 an ignored `?utm_source=` still yields a correct value and refusing it would
 cost compatibility without buying correctness.

 @param searchParams - parsed query of the inbound request

 @returns inclusive bounds, both validated and ordered

 @throws BadRequestError when a parameter repeats, is absent, is
   non-canonical, is out of order, or spans a wider interval than a uniform
   draw can represent exactly

 @example
 ```ts
 parseIntParams({
   searchParams: new URLSearchParams('min=1&max=6',),
 },); // { min: 1, max: 6 }
 ```
 */
export function parseIntParams({ searchParams, }: ParseIntParamsParams,): IntBounds {
  for (const name of INT_PARAMETER_NAMES) {
    /**
     Every value supplied for this name.
     */
    const values = searchParams.getAll(name,);
    if (values.length > 1) {
      throw new BadRequestError(`query parameter "${name}" must appear at most once, but it appeared ${String(values.length)} times`,);
    }
  }
  /**
   Lower bound.
   */
  const min = requiredInteger({
    searchParams,
    name: 'min',
  },);
  /**
   Upper bound.
   */
  const max = requiredInteger({
    searchParams,
    name: 'max',
  },);
  if (min > max) {
    throw new BadRequestError(`query parameter "min" must not exceed "max", got min=${String(min)} and max=${String(max)}`,);
  }
  // The span is the count of integers in the closed interval, one more than
  // the difference. Testing the difference is exact where testing the span is
  // not: subtracting two doubles that are both integers yields the true result
  // whenever that result is representable, and every integer up to the safe
  // limit is, whereas adding one first can reach 2^53 and round. A difference
  // at the safe limit gives a span of exactly 2^53, the widest interval the
  // 53-bit draw covers without rounding.
  if (!Number.isSafeInteger(max - min,)) {
    throw new BadRequestError(`the difference between "max" and "min" must be at most ${String(Number.MAX_SAFE_INTEGER)}, got ${String(min)} to ${String(max)}`,);
  }
  return {
    min,
    max,
  };
}

/**
 Parameters for {@link parseLengthRoute}.
 */
export type ParseLengthRouteParams = {
  /**
   Lowercased request path including the leading slash.
   */
  readonly pathname: string;
};

/**
 Resolve a single-segment path to the string length it requests.

 @param pathname - lowercased request path including the leading slash

 @returns length to draw, between 1 and {@link MAX_RANDOM_LENGTH}

 @throws NotFoundError when the path has more than one segment, or its single
   segment does not look numeric

 @throws BadRequestError when the segment looks numeric but is non-canonical
   or falls outside the served range

 @example
 ```ts
 parseLengthRoute({ pathname: '/8', },); // 8
 ```
 */
export function parseLengthRoute({ pathname, }: ParseLengthRouteParams,): number {
  /**
   Path without its leading slash.
   */
  const segment = pathname.startsWith('/',) ? pathname.slice(1,) : pathname;
  if ((segment === '') || segment.includes('/',)
    || (!looksNumeric(segment,))) {
    throw new NotFoundError(noRouteMessage(pathname,),);
  }
  /**
   Requested length, validated as a canonical integer.
   */
  const length = parseCanonicalInteger({
    text: segment,
    label: `path segment "${segment}"`,
  },);
  if ((length < 1) || (length > MAX_RANDOM_LENGTH)) {
    throw new BadRequestError(`length must be between 1 and ${String(MAX_RANDOM_LENGTH)}, got "${segment}"`,);
  }
  return length;
}

//endregion Routes
