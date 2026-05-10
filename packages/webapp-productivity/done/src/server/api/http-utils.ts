/**
 * Shared HTTP response utilities for API handlers.
 */

import { HTTP_OK, } from '@monochromatic-dev/module-numeric-const';

export {
  HTTP_BAD_REQUEST,
  HTTP_CONFLICT,
  HTTP_CREATED,
  HTTP_INTERNAL_SERVER_ERROR,
  HTTP_NOT_FOUND,
  HTTP_OK,
} from '@monochromatic-dev/module-numeric-const';

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
 * return jsonResponse({ ok: true }, 200);
 * ```
 */
export function jsonResponse(
  payload: unknown,
  status: number = HTTP_OK,
): Response {
  return Response.json(
    payload,
    { status, },
  );
}
