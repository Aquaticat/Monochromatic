import { isJsonRecord, } from './json-guard.ts';

//region Quota snapshot
// Typed view over `GET /v2/quotas`, shape verified with a live call on 2026-07-16.
// Only the fields budget decisions consume are modeled: the rolling five-hour
// request limit (throttling) and the weekly credit limit (spend pacing). Quota
// reads are free per provider docs, so drivers may poll without budget cost.
// A malformed body is a provider protocol failure and throws, unlike model-content
// defects which flow as data.

/**
 * Budget-relevant quota state at one instant.
 * Verified live response also carries `subscription`, `search`, and
 * `freeToolCalls` blocks; they are deliberately unmodeled until something
 * consumes them.
 *
 * @example
 * ```ts
 * const snapshot: QuotaSnapshot = {
 *   fiveHour: { remaining: 750, max: 750, limited: false, nextTickAt: '2026-07-16T22:55:29.000Z', },
 *   weekly: { percentRemaining: 99.8, nextRegenAt: '2026-07-17T00:12:58.000Z', },
 * };
 * ```
 */
export type QuotaSnapshot = {
  /**
   * Rolling five-hour request limit;
   * regenerates 5% every 15 minutes.
   */
  readonly fiveHour: {
    /**
     * Price-weighted requests still available.
     */
    readonly remaining: number;

    /**
     * Ceiling of the rolling window; scales with packs.
     */
    readonly max: number;

    /**
     * Whether the provider currently throttles this account.
     */
    readonly limited: boolean;

    /**
     * ISO timestamp of next regeneration tick.
     */
    readonly nextTickAt: string;
  };

  /**
   * Weekly credit limit; regenerates 2% roughly every 3.4 hours.
   */
  readonly weekly: {
    /**
     * Percent of weekly credits still available.
     */
    readonly percentRemaining: number;

    /**
     * ISO timestamp of next credit regeneration.
     */
    readonly nextRegenAt: string;
  };
};

/**
 * Signals a `/quotas` body that refused to parse or lacked consumed fields;
 * always a provider protocol failure, never a model defect.
 *
 * @example
 * ```ts
 * throw new QuotaShapeError({ detail: 'rollingFiveHourLimit.remaining is not a number', },);
 * ```
 */
export class QuotaShapeError extends Error {
  /**
   * Builds failure naming the field or parse step at fault.
   *
   * @param detail - which expectation the body violated
   *
   * @param cause - underlying parse error when JSON itself failed
   *
   * @example
   * ```ts
   * new QuotaShapeError({ detail: 'body is not valid JSON', cause: error, },);
   * ```
   */
  public constructor(
    {
      detail,
      cause,
    }: {
      readonly detail: string;
      readonly cause?: unknown;
    },
  ) {
    super(
      `Synthetic /quotas body violated expectations: ${detail}`,
      // Conditional spread keeps cause absent when none was supplied.
      ...(cause === undefined
        ? []
        : [{ cause, },]),
    );
    this.name = 'QuotaShapeError';
  }
}

/**
 * Parses body text as JSON, converting parse failures into shape errors.
 *
 * @param bodyText - raw response body
 *
 * @returns Parsed JSON value
 *
 * @throws {@link QuotaShapeError} when body is not valid JSON
 *
 * @example
 * ```ts
 * const parsed = parseQuotaJson({ bodyText, },);
 * ```
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
 * Parses one `/quotas` body into the typed snapshot,
 * validating every consumed field.
 *
 * @param bodyText - raw 200-response body
 *
 * @returns Typed snapshot of budget-relevant quota state
 *
 * @throws {@link QuotaShapeError} when body is not JSON or a consumed field is missing or mistyped
 *
 * @example
 * ```ts
 * const snapshot = parseQuotaSnapshot({ bodyText: reply.bodyText, },);
 * if (snapshot.fiveHour.limited) backOff(snapshot.fiveHour.nextTickAt,);
 * ```
 */
export function parseQuotaSnapshot(
  { bodyText, }: { readonly bodyText: string; },
): QuotaSnapshot {
  /**
   * Whole parsed body, probed field by field.
   */
  const parsed = parseQuotaJson({ bodyText, },);
  if (!isJsonRecord(parsed,))
    throw new QuotaShapeError({ detail: 'body is not a JSON object', },);

  /**
   * Rolling five-hour block as delivered.
   */
  const { rollingFiveHourLimit: fiveHour, } = parsed;
  if (!isJsonRecord(fiveHour,))
    throw new QuotaShapeError({ detail: 'rollingFiveHourLimit is not an object', },);

  /**
   * Weekly credit block as delivered.
   */
  const { weeklyTokenLimit: weekly, } = parsed;
  if (!isJsonRecord(weekly,))
    throw new QuotaShapeError({ detail: 'weeklyTokenLimit is not an object', },);

  /**
   * Five-hour fields pulled out for type validation.
   */
  const {
    remaining,
    max,
    limited,
    nextTickAt,
  } = fiveHour;
  if ((typeof remaining) !== 'number')
    throw new QuotaShapeError({ detail: 'rollingFiveHourLimit.remaining is not a number', },);
  if ((typeof max) !== 'number')
    throw new QuotaShapeError({ detail: 'rollingFiveHourLimit.max is not a number', },);
  if ((typeof limited) !== 'boolean')
    throw new QuotaShapeError({ detail: 'rollingFiveHourLimit.limited is not a boolean', },);
  if ((typeof nextTickAt) !== 'string')
    throw new QuotaShapeError({ detail: 'rollingFiveHourLimit.nextTickAt is not a string', },);

  /**
   * Weekly fields pulled out for type validation.
   */
  const {
    percentRemaining,
    nextRegenAt,
  } = weekly;
  if ((typeof percentRemaining) !== 'number')
    throw new QuotaShapeError({ detail: 'weeklyTokenLimit.percentRemaining is not a number', },);
  if ((typeof nextRegenAt) !== 'string')
    throw new QuotaShapeError({ detail: 'weeklyTokenLimit.nextRegenAt is not a string', },);

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
