/**
 * Shared HTTP response utilities for API handlers.
 */

import { HTTP_OK, } from '@monochromatic-dev/module-const/ts';

export {
  HTTP_BAD_REQUEST,
  HTTP_CONFLICT,
  HTTP_CREATED,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_NOT_FOUND,
  HTTP_OK,
} from '@monochromatic-dev/module-const/ts';

/**
 * Wraps a payload in a JSON `Response` with the correct content type.
 *
 * @param payload - Serializable value
 *
 * @param status - HTTP status code (defaults to 200)
 *
 * @returns JSON response with content-type header
 *
 * @example
 * ```ts
 * return jsonResponse({ payload: { ok: true }, status: 200 });
 * ```
 */
export function jsonResponse(
  {
    payload,
    status = HTTP_OK,
  }: {
    readonly payload: unknown;
    readonly status?: number;
  },
): Response {
  return Response.json(
    payload,
    { status, },
  );
}
