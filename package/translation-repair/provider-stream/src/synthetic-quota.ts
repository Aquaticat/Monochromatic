import { isJsonRecord, } from '@monochromatic-dev/translation-repair-document-structure/ts';

//region Quota snapshot
// Typed view over `GET /v2/quotas`, shape verified with a live call on 2026-07-16.
// Only the fields budget decisions consume are modeled: the rolling five-hour
// request limit (throttling) and the weekly credit limit (spend pacing). Quota
// reads are free per provider docs, so drivers may poll without budget cost.
// A malformed body is a provider protocol failure and throws, unlike model-content
// defects which flow as data.
//
// THE SHAPE READ HERE IS THE ONE OF 2026-07-16, AND NO PUBLIC SOURCE GIVES ANOTHER (ledger B671). A pre-launch reading on
// 2026-10-18 met a body whose `rollingFiveHourLimit` was not an object, and this reader refuses such a body; the caller treats
// the budget as spendable and warns (`meterRecordOf`, `provider-meters.ts`). Synthetic's documentation of the endpoint
// (`dev.synthetic.new/docs/synthetic/quotas`) still shows only the older `subscription` block. Its maintainer wrote on
// 2026-09-15, in `slkiser/opencode-quota` issue 276, that a bearer API key returns the full quota JSON with `weeklyTokenLimit`
// and `rollingFiveHourLimit`, and that `subscription` and `freeToolCalls` are legacy keys the named limits replace. The same
// issue records a key on an account the reporter took to be on the free tier answered with status 200 and the body `{}`,
// which this reader refuses by the same message; Synthetic has not said whether `{}` is intended for such an account. The body
// of the 2026-10-18 reading was not recorded, so whether it was `{}`, a block under another name or something else is not known,
// and no second shape is read here. A refusal now says what arrived: the top-level key names with the JSON type of each, or the
// type of a body that is no object, and never a value (`QuotaShapeError`), so the next reading settles it.

/**
 Budget-relevant quota state at one instant.
 Verified live response also carries `subscription`, `search`, and
 `freeToolCalls` blocks; they are deliberately unmodeled until something
 consumes them.

 @example
 ```ts
 const snapshot: QuotaSnapshot = {
   fiveHour: { remaining: 750, max: 750, limited: false, nextTickAt: '2026-07-16T22:55:29.000Z', },
   weekly: { percentRemaining: 99.8, nextRegenAt: '2026-07-17T00:12:58.000Z', },
 };
 ```
 */
export type QuotaSnapshot = {
  /**
   Rolling five-hour request limit;
   regenerates 5% every 15 minutes.
   */
  readonly fiveHour: {
    /**
     Price-weighted requests still available.
     */
    readonly remaining: number;

    /**
     Ceiling of the rolling window; scales with packs.
     */
    readonly max: number;

    /**
     Whether the provider currently throttles this account.
     */
    readonly limited: boolean;

    /**
     ISO timestamp of next regeneration tick.
     */
    readonly nextTickAt: string;
  };

  /**
   Weekly credit limit; regenerates 2% roughly every 3.4 hours.
   */
  readonly weekly: {
    /**
     Percent of weekly credits still available.
     */
    readonly percentRemaining: number;

    /**
     ISO timestamp of next credit regeneration.
     */
    readonly nextRegenAt: string;
  };
};

/**
 Signals a `/quotas` body that refused to parse or lacked consumed fields;
 always a provider protocol failure, never a model defect.

 @example
 ```ts
 throw new QuotaShapeError({ detail: 'rollingFiveHourLimit.remaining is not a number', },);
 ```
 */
export class QuotaShapeError extends Error {
  /**
   Declares this message safe to forward: it names the field that failed its shape and the keys and types the body held, never a value of the body.
   */
  readonly messageNamesOnly: true = true;

  /**
   Builds failure naming the field or parse step at fault.

   @param detail - which expectation the body violated

   @param cause - underlying parse error when JSON itself failed

   @param received - the keys the body held and the JSON type of each, or the type of a body that is no object, so a reader of the
   log sees what arrived without a value; absent when the body was no JSON

   @example
   ```ts
   new QuotaShapeError({ detail: 'body is not valid JSON', cause: error, },);
   ```
   */
  public constructor(
    {
      detail,
      cause,
      received,
    }: {
      readonly detail: string;
      readonly cause?: unknown;
      readonly received?: string;
    },
  ) {
    super(
      `Synthetic /quotas body violated expectations: ${detail}${
        (received === undefined)
          ? ''
          : `; received ${received}`
      }`,
      // Conditional spread keeps cause absent when none was supplied.
      ...(cause === undefined
        ? []
        : [{ cause, },]),
    );
    this.name = 'QuotaShapeError';
  }
}

/**
 Parses body text as JSON, converting parse failures into shape errors.

 @param bodyText - raw response body

 @returns Parsed JSON value

 @throws {@link QuotaShapeError} when body is not valid JSON

 @example
 ```ts
 const parsed = parseQuotaJson({ bodyText, },);
 ```
 */
function parseQuotaJson({ bodyText, }: { readonly bodyText: string; },): unknown {
  try {
    return JSON.parse(bodyText,);
  }
  catch (error) {
    throw new QuotaShapeError({
      detail: 'body is not valid JSON',
      cause: error,
    },);
  }
}

/**
 How many top-level keys a refusal lists before it counts the rest.
 */
const RECEIVED_KEYS_LISTED = 20;

/**
 How many characters of a key name a refusal keeps.
 */
const RECEIVED_KEY_NAME_LENGTH = 40;

/**
 The JSON type of a parsed value.

 @param value - parsed JSON value

 @returns `null`, `array`, `object`, `string`, `number` or `boolean`

 @example
 ```ts
 const type = jsonTypeOf({ value: [], },); // 'array'
 ```
 */
function jsonTypeOf({ value, }: { readonly value: unknown; },): string {
  if (value === null)
    return 'null';
  return Array.isArray(value,) ? 'array' : (typeof value);
}

/**
 Describes what a refused body held without a value of it: the top-level key names with the JSON type of each, or the type of a
 body that is no object. A key name is cut to a bounded length and keeps printable ASCII only, and the keys listed are bounded.

 @param parsed - the parsed body

 @returns `{}` for an empty object, `subscription:object, freeToolCalls:object` for keys, or the type name for any other value

 @example
 ```ts
 const received = receivedShapeOf({ parsed: { subscription: { limit: 1, }, }, },); // 'subscription:object'
 ```
 */
function receivedShapeOf({ parsed, }: { readonly parsed: unknown; },): string {
  if (!isJsonRecord(parsed,))
    return jsonTypeOf({ value: parsed, },);
  /**
   The keys and values of the body.
   */
  const entries = Object.entries(parsed,);
  if (entries.length === 0)
    return '{}';
  /**
   The keys listed, each with the type of its value.
   */
  const listed = entries
    .slice(
      0,
      RECEIVED_KEYS_LISTED,
    )
    .map(function described([key, value,],): string {
      return `${key.replaceAll(/[^\u0020-\u007E]/gu, '?',).slice(
        0,
        RECEIVED_KEY_NAME_LENGTH,
      )}:${jsonTypeOf({ value, },)}`;
    },);
  return (entries.length > RECEIVED_KEYS_LISTED)
    ? `${listed.join(', ',)}, and ${String(entries.length - RECEIVED_KEYS_LISTED,)} more`
    : listed.join(', ',);
}

/**
 Builds the refusal of a parsed body that violates the expected shape.

 @param detail - which expectation the body violated

 @param parsed - the parsed body, described by its keys and their types and never by a value

 @returns The error to throw

 @example
 ```ts
 throw shapeRefusal({ detail: 'weeklyTokenLimit is not an object', parsed, },);
 ```
 */
function shapeRefusal({ detail, parsed, }: { readonly detail: string; readonly parsed: unknown; },): QuotaShapeError {
  return new QuotaShapeError({
    detail,
    received: receivedShapeOf({ parsed, },),
  },);
}

/**
 Parses one `/quotas` body into the typed snapshot,
 validating every consumed field.

 @param bodyText - raw 200-response body

 @returns Typed snapshot of budget-relevant quota state

 @throws {@link QuotaShapeError} when body is not JSON or a consumed field is missing or mistyped

 @example
 ```ts
 const snapshot = parseQuotaSnapshot({ bodyText: reply.bodyText, },);
 if (snapshot.fiveHour.limited) backOff(snapshot.fiveHour.nextTickAt,);
 ```
 */
export function parseQuotaSnapshot(
  { bodyText, }: { readonly bodyText: string; },
): QuotaSnapshot {
  /**
   Whole parsed body, probed field by field.
   */
  const parsed = parseQuotaJson({ bodyText, },);
  if (!isJsonRecord(parsed,))
    throw shapeRefusal({ detail: 'body is not a JSON object', parsed, },);

  /**
   Rolling five-hour block as delivered.
   */
  const { rollingFiveHourLimit: fiveHour, } = parsed;
  if (!isJsonRecord(fiveHour,))
    throw shapeRefusal({ detail: 'rollingFiveHourLimit is not an object', parsed, },);

  /**
   Weekly credit block as delivered.
   */
  const { weeklyTokenLimit: weekly, } = parsed;
  if (!isJsonRecord(weekly,))
    throw shapeRefusal({ detail: 'weeklyTokenLimit is not an object', parsed, },);

  /**
   Five-hour fields pulled out for type validation.
   */
  const {
    remaining,
    max,
    limited,
    nextTickAt,
  } = fiveHour;
  if ((typeof remaining) !== 'number')
    throw shapeRefusal({ detail: 'rollingFiveHourLimit.remaining is not a number', parsed, },);
  if ((typeof max) !== 'number')
    throw shapeRefusal({ detail: 'rollingFiveHourLimit.max is not a number', parsed, },);
  if ((typeof limited) !== 'boolean')
    throw shapeRefusal({ detail: 'rollingFiveHourLimit.limited is not a boolean', parsed, },);
  if ((typeof nextTickAt) !== 'string')
    throw shapeRefusal({ detail: 'rollingFiveHourLimit.nextTickAt is not a string', parsed, },);

  /**
   Weekly fields pulled out for type validation.
   */
  const {
    percentRemaining,
    nextRegenAt,
  } = weekly;
  if ((typeof percentRemaining) !== 'number')
    throw shapeRefusal({ detail: 'weeklyTokenLimit.percentRemaining is not a number', parsed, },);
  if ((typeof nextRegenAt) !== 'string')
    throw shapeRefusal({ detail: 'weeklyTokenLimit.nextRegenAt is not a string', parsed, },);

  return {
    fiveHour: {
      remaining,
      max,
      limited,
      nextTickAt,
    },
    weekly: {
      percentRemaining,
      nextRegenAt,
    },
  };
}

//endregion Quota snapshot
