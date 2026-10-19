import { isJsonRecord, } from '@monochromatic-dev/translation-repair-document-structure/ts';

//region Quota snapshot
// Typed view over `GET /v2/quotas`. Only the fields budget decisions consume are modeled: the weekly credit limit (spend pacing)
// and, where a reply still carries one, the rolling five-hour request limit (throttling). Quota reads are free per provider docs,
// so drivers may poll without budget cost. A malformed body is a provider protocol failure and throws, unlike model-content
// defects which flow as data.
//
// THE FIVE-HOUR WINDOW IS OPTIONAL SINCE 2026-10-19 (ledger B671; GitHub issue 1779 tracks the unreadable meter). Synthetic's
// rate-limit page (`https://synthetic.new/rate-limits`, fetched 2026-10-19) describes only a weekly credit limit: "Every 202
// minutes (about 3.4 hours), you get back 2% of your total weekly credit limit." Its rolling five-hour request limit and its
// concurrency limits are gone from that page. A live reading of `GET /v2/quotas` on 2026-10-19 at 14:35 UTC returned an object
// whose top-level keys were exactly `subscription`, `search`, `freeToolCalls` and `weeklyTokenLimit`, each an object, with no
// `rollingFiveHourLimit`. The inner fields of `weeklyTokenLimit` were not observed in that reading, because the reader of the
// day refused the body before reaching them; `percentRemaining` and `nextRegenAt` are the names of the 2026-07-16 reading, the
// last in which the block was seen, and a refusal inside the block now says which keys it holds so the next live reading
// settles them.
//
// A BODY WITHOUT THE `rollingFiveHourLimit` KEY YIELDS A SNAPSHOT WITH NO FIVE-HOUR WINDOW. A body that carries the key is read as
// before: the block must be an object (`null` is refused) and each field must have its type, and the older two-block shape of
// 2026-07-16 stays readable, so an account whose reply still carries the window is honoured. The refusal of the pre-launch reading
// of 2026-10-18 (ledger B671) is consistent with a body that already lacked the key, though that body was not recorded. The
// maintainer of Synthetic wrote on 2026-09-15, in `slkiser/opencode-quota` issue 276, that a bearer API key returns the full quota
// JSON with `weeklyTokenLimit` and `rollingFiveHourLimit`; the reading of 2026-10-19 supersedes that for the five-hour block. The
// same issue records a key on an account the reporter took to be on the free tier answered with status 200 and the body `{}`,
// which this reader refuses for lack of `weeklyTokenLimit`. A refusal says what arrived: the top-level key names with the JSON type
// of each, or the type of a body that is no object, and, when the fault is a field inside a block, that block's own key names with
// the JSON type of each; never a value (`QuotaShapeError`).

/**
 Budget-relevant quota state at one instant.
 Verified live response also carries `subscription`, `search`, and
 `freeToolCalls` blocks; they are deliberately unmodeled until something
 consumes them.

 THE FIVE-HOUR WINDOW MAY BE ABSENT, as in the reply of 2026-10-19 (see the
 region comment); the weekly block is always present.

 @example
 ```ts
 const snapshot: QuotaSnapshot = {
   fiveHour: { remaining: 750, max: 750, limited: false, nextTickAt: '2026-07-16T22:55:29.000Z', },
   weekly: { percentRemaining: 99.8, nextRegenAt: '2026-07-17T00:12:58.000Z', },
 };
 const weeklyOnly: QuotaSnapshot = {
   weekly: { percentRemaining: 99.8, nextRegenAt: '2026-10-20T00:12:58.000Z', },
 };
 ```
 */
export type QuotaSnapshot = {
  /**
   Rolling five-hour request limit, present only when the reply carries the
   block; regenerates 5% every 15 minutes where it exists.
   */
  readonly fiveHour?: {
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
   Declares this message safe to forward: it names the field that failed its shape and the keys and types the body held, and the block's when the fault is inside one, never a value of the body.
   */
  readonly messageNamesOnly: true = true;

  /**
   Builds failure naming the field or parse step at fault.

   @param detail - which expectation the body violated

   @param cause - underlying parse error when JSON itself failed

   @param received - the keys the body held and the JSON type of each, or the type of a body that is no object, followed for a fault
   inside a block by that block's own keys and the JSON type of each, so a reader of the log sees what arrived without a value;
   absent when the body was no JSON

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
 The first code point of printable ASCII, the space.
 */
const FIRST_PRINTABLE = 0x20;

/**
 The last code point of printable ASCII, the tilde.
 */
const LAST_PRINTABLE = 0x7E;

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
 A key name as a refusal prints it: printable ASCII only, each other character as a question mark, and cut to a bounded length, since a
 key is provider text that reaches a log.

 @param key - a top-level key of the refused body

 @returns The key name to print

 @example
 ```ts
 const printed = boundedKeyOf({ key: 'subscri\u0000ption', },); // 'subscri?ption'
 ```
 */
function boundedKeyOf({ key, }: { readonly key: string; },): string {
  return Array.from(
    key,
    function printable(character,): string {
      /**
       The code point of the character.
       */
      const code = character.codePointAt(0,) ?? 0;
      return ((code >= FIRST_PRINTABLE) && (code <= LAST_PRINTABLE)) ? character : '?';
    },
  )
    .slice(
      0,
      RECEIVED_KEY_NAME_LENGTH,
    )
    .join('',);
}

/**
 Describes the keys of one JSON object without a value of it: each key name with the JSON type of its value. A key name is cut to a
 bounded length and keeps printable ASCII only, and the keys listed are bounded.

 @param record - a parsed JSON object, the body or one block of it

 @returns `{}` for an empty object, `subscription:object, freeToolCalls:object` for keys, or the first twenty keys and a count of the rest

 @example
 ```ts
 const keys = describedKeysOf({ record: { percentRemaining: 87, nextRegenAt: 'soon', }, },); // 'percentRemaining:number, nextRegenAt:string'
 ```
 */
function describedKeysOf({ record, }: { readonly record: Readonly<Record<string, unknown>>; },): string {
  /**
   The keys and values of the object.
   */
  const entries = Object.entries(record,);
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
      return `${boundedKeyOf({ key, },)}:${jsonTypeOf({ value, },)}`;
    },);
  return (entries.length > RECEIVED_KEYS_LISTED)
    ? `${listed.join(', ',)}, and ${String(entries.length - RECEIVED_KEYS_LISTED,)} more`
    : listed.join(', ',);
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
  return describedKeysOf({ record: parsed, },);
}

/**
 Builds the refusal of a parsed body that violates the expected shape.

 @param detail - which expectation the body violated

 @param parsed - the parsed body, described by its keys and their types and never by a value

 @returns The error to throw

 @example
 ```ts
 throw shapeRefusal({
   detail: 'weeklyTokenLimit is not an object',
   parsed,
 },);
 ```
 */
function shapeRefusal(
  {
    detail,
    parsed,
  }: {
    readonly detail: string;
    readonly parsed: unknown;
  },
): QuotaShapeError {
  return new QuotaShapeError({
    detail,
    received: receivedShapeOf({ parsed, },),
  },);
}

/**
 Builds the refusal of a field inside one block of a parsed body.

 DESCRIBES THE BLOCK AS WELL AS THE BODY. A field refused inside `weeklyTokenLimit` says which keys that block holds and the JSON
 type of each, so the next live reading shows the block's real fields if they are not the ones this reader expects, with the same
 bounds as the body's description and never a value.

 @param detail - which expectation the block violated

 @param parsed - the parsed body, described by its keys and their types

 @param blockName - the key of the block at fault

 @param block - the block at fault, described by its keys and their types

 @returns The error to throw

 @example
 ```ts
 throw blockRefusal({
   detail: 'weeklyTokenLimit.percentRemaining is not a number',
   parsed,
   blockName: 'weeklyTokenLimit',
   block: weekly,
 },);
 ```
 */
function blockRefusal(
  {
    detail,
    parsed,
    blockName,
    block,
  }: {
    readonly detail: string;
    readonly parsed: unknown;
    readonly blockName: 'rollingFiveHourLimit' | 'weeklyTokenLimit';
    readonly block: Readonly<Record<string, unknown>>;
  },
): QuotaShapeError {
  return new QuotaShapeError({
    detail,
    received: `${receivedShapeOf({ parsed, },)}; ${blockName} holds ${describedKeysOf({ record: block, },)}`,
  },);
}

/**
 Validates the fields of a five-hour block and reads them out.

 @param parsed - the parsed body, described in a refusal

 @param block - the five-hour block of that body

 @returns The typed five-hour window

 @throws {@link QuotaShapeError} when a field is missing or mistyped

 @example
 ```ts
 const fiveHour = fiveHourWindowOf({ parsed, block, },);
 ```
 */
function fiveHourWindowOf(
  {
    parsed,
    block,
  }: {
    readonly parsed: Readonly<Record<string, unknown>>;
    readonly block: Readonly<Record<string, unknown>>;
  },
): NonNullable<QuotaSnapshot['fiveHour']> {
  /**
   Five-hour fields pulled out for type validation.
   */
  const {
    remaining,
    max,
    limited,
    nextTickAt,
  } = block;
  if ((typeof remaining) !== 'number')
    throw blockRefusal({
      detail: 'rollingFiveHourLimit.remaining is not a number',
      parsed,
      blockName: 'rollingFiveHourLimit',
      block,
    },);
  if ((typeof max) !== 'number')
    throw blockRefusal({
      detail: 'rollingFiveHourLimit.max is not a number',
      parsed,
      blockName: 'rollingFiveHourLimit',
      block,
    },);
  if ((typeof limited) !== 'boolean')
    throw blockRefusal({
      detail: 'rollingFiveHourLimit.limited is not a boolean',
      parsed,
      blockName: 'rollingFiveHourLimit',
      block,
    },);
  if ((typeof nextTickAt) !== 'string')
    throw blockRefusal({
      detail: 'rollingFiveHourLimit.nextTickAt is not a string',
      parsed,
      blockName: 'rollingFiveHourLimit',
      block,
    },);

  return {
    remaining,
    max,
    limited,
    nextTickAt,
  };
}

/**
 Validates the fields of a weekly block and reads them out.

 @param parsed - the parsed body, described in a refusal

 @param block - the weekly block of that body

 @returns The typed weekly window

 @throws {@link QuotaShapeError} when a field is missing or mistyped

 @example
 ```ts
 const weekly = weeklyWindowOf({ parsed, block, },);
 ```
 */
function weeklyWindowOf(
  {
    parsed,
    block,
  }: {
    readonly parsed: Readonly<Record<string, unknown>>;
    readonly block: Readonly<Record<string, unknown>>;
  },
): QuotaSnapshot['weekly'] {
  /**
   Weekly fields pulled out for type validation.
   */
  const {
    percentRemaining,
    nextRegenAt,
  } = block;
  if ((typeof percentRemaining) !== 'number')
    throw blockRefusal({
      detail: 'weeklyTokenLimit.percentRemaining is not a number',
      parsed,
      blockName: 'weeklyTokenLimit',
      block,
    },);
  if ((typeof nextRegenAt) !== 'string')
    throw blockRefusal({
      detail: 'weeklyTokenLimit.nextRegenAt is not a string',
      parsed,
      blockName: 'weeklyTokenLimit',
      block,
    },);

  return {
    percentRemaining,
    nextRegenAt,
  };
}

/**
 Parses one `/quotas` body into the typed snapshot,
 validating every consumed field.

 THE WEEKLY BLOCK IS REQUIRED AND THE FIVE-HOUR BLOCK IS NOT. A body without the `rollingFiveHourLimit` key yields a snapshot with no
 `fiveHour` property; a body that carries the key must carry a well-formed block.

 @param bodyText - raw 200-response body

 @returns Typed snapshot of budget-relevant quota state

 @throws {@link QuotaShapeError} when body is not JSON, the weekly block is missing or mistyped, or the five-hour block is present
 and mistyped

 @example
 ```ts
 const snapshot = parseQuotaSnapshot({ bodyText: reply.bodyText, },);
 if (snapshot.fiveHour?.limited) backOff(snapshot.fiveHour.nextTickAt,);
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
    throw shapeRefusal({
      detail: 'body is not a JSON object',
      parsed,
    },);

  /**
   Whether the body carries the five-hour key at all, which is the only thing that makes the window optional: a present key must
   hold an object.
   */
  const carriesFiveHour = Object.hasOwn(
    parsed,
    'rollingFiveHourLimit',
  );

  /**
   Rolling five-hour block and weekly credit block as delivered.
   */
  const {
    rollingFiveHourLimit: fiveHourBlock,
    weeklyTokenLimit: weekly,
  } = parsed;
  if (carriesFiveHour && (!isJsonRecord(fiveHourBlock,)))
    throw shapeRefusal({
      detail: 'rollingFiveHourLimit is not an object',
      parsed,
    },);
  if (!isJsonRecord(weekly,))
    throw shapeRefusal({
      detail: 'weeklyTokenLimit is not an object',
      parsed,
    },);

  /**
   The five-hour window as a property to spread: empty when the body had no such key, since a key that is present and no object
   was refused above.
   */
  const fiveHourEntry = isJsonRecord(fiveHourBlock,)
    ? {
      fiveHour: fiveHourWindowOf({
        parsed,
        block: fiveHourBlock,
      },),
    }
    : {};

  return {
    ...fiveHourEntry,
    weekly: weeklyWindowOf({
      parsed,
      block: weekly,
    },),
  };
}

//endregion Quota snapshot
