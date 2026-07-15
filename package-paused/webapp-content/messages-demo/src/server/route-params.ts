/**
 * h3 route-parameter and conditional-header helpers.
 *
 * Split from `server.ts` so the entry module stays under the line cap.
 * `paramsInput` / `ifNoneMatchInput` bridge h3's `| undefined` params and
 * Web Storage's `string | null` header into spreadable objects whose
 * optional property is omitted when absent, so call sites compose them
 * under `exactOptionalPropertyTypes` without naming a nullish slot.
 */

import {
  HTTPError,
} from 'h3';

import { HTTP_BAD_REQUEST, } from '../lib/http.ts';

/**
 * Radix used for explicit decimal integer parsing.
 */
const DECIMAL_RADIX = 10;

/**
 * Bridges h3's `event.context.params` (present or `undefined`) into a
 * spreadable object whose `params` property is omitted when absent.
 *
 * @param params - h3 route parameter record, or `undefined` when none matched
 *
 * @returns object carrying `params` only when present
 *
 * @example
 * ```ts
 * requireParam({ ...paramsInput(event.context.params), name: 'cursor' });
 * ```
 */
export function paramsInput(
  params?: Readonly<Record<string, string>>,
): { readonly params?: Readonly<Record<string, string>>; } {
  if (params === undefined)
    return {};
  return { params, };
}

/**
 * Reads the request `If-None-Match` header into a spreadable object whose
 * `ifNoneMatch` property is omitted when the header is absent. `headers.get`
 * returns `string | null`; this folds the null into an omitted optional
 * so renderers never name a nullish slot.
 *
 * @param headers - request headers
 *
 * @returns object carrying `ifNoneMatch` only when the header is present
 *
 * @example
 * ```ts
 * await renderFeed({ ...ifNoneMatchInput(event.req.headers) });
 * ```
 */
export function ifNoneMatchInput(
  headers: Headers,
): { readonly ifNoneMatch?: string; } {
  /**
   * Raw header; `null` (absent) collapses to an omitted optional below.
   */
  const raw = headers.get('if-none-match',);
  if (raw === null)
    return {};
  return { ifNoneMatch: raw, };
}

/**
 * Extracts a path parameter, throwing a 400 when missing.
 *
 * @param input - h3 route parameter record and the parameter name
 *
 * @returns parameter value
 *
 * @example
 * ```ts
 * const cursor = requireParam({ params: event.context.params, name: 'cursor' });
 * ```
 */
export function requireParam(
  input: {
    readonly params?: Readonly<Record<string, string>>;
    readonly name: string;
  },
): string {
  /**
   * Indexed once so the empty-string check and the return both reference the same value.
   */
  const value = input.params?.[input.name];
  if ((value === undefined) || (value === '')) {
    throw new HTTPError({
      status: HTTP_BAD_REQUEST,
      message: `missing route param: ${input.name}`,
    },);
  }
  return value;
}

/**
 * Parses a route parameter as a non-negative integer. Used for both
 * message ids and chunk indices.
 *
 * @param input - h3 route parameter record, the parameter name, and the
 *                minimum acceptable value (1 for ids, 0 for indices)
 *
 * @returns parsed integer
 *
 * @example
 * ```ts
 * const id = parseId({ params: event.context.params, name: 'id', min: 1 });
 * ```
 */
export function parseId(
  input: {
    readonly params?: Readonly<Record<string, string>>;
    readonly name: string;
    readonly min?: number;
  },
): number {
  /**
   * Defaults to `1`; ids start at 1, chunk indices pass `min: 0`.
   */
  const min = input.min
    ?? 1;
  /**
   * Raw param string forwarded into `Number.parseInt`.
   */
  const raw = requireParam({
    ...paramsInput(input.params,),
    name: input.name,
  },);
  /**
   * Parsed integer; non-finite or below-minimum triggers a 400 below.
   */
  const parsed = Number.parseInt(
    raw,
    DECIMAL_RADIX,
  );
  if ((!Number.isFinite(parsed,)) || (parsed < min)) {
    throw new HTTPError({
      status: HTTP_BAD_REQUEST,
      message: `invalid ${input.name}: ${raw}`,
    },);
  }
  return parsed;
}
