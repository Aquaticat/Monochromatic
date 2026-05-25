/**
 * Tiny JSON-cast helper used by the composer.
 *
 * `Response.json()` returns `unknown` (or `any`, depending on the
 * runtime), so callers always need to assert a shape. Centralising the
 * assertion in one place lets us suppress the `no-unsafe-type-assertion`
 * rule with a single justification.
 */

/**
 * Awaits `response.json()` and casts the result to the caller-supplied
 * shape. Caller is responsible for narrowing the optional fields before
 * use.
 *
 * @param response - the `Response` whose body to decode
 *
 * @returns decoded body coerced to `T`
 *
 * @example
 * ```ts
 * const body = await readJson<{ ack?: number; }>(resp);
 * ```
 */
export async function readJson<T,>(response: Response,): Promise<T> {
  // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- Response.json returns any
  return await response.json() as T;
}
