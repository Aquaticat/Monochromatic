/**
 * Dynamically imports a SQL file using `with { type: 'text' }` attribute.
 *
 * @returns raw SQL content as a string
 *
 * @example
 * ```ts
 * const sql = await getQuery();
 * // sql contains raw contents of ./sample.sql
 * ```
 */
export async function getQuery(): Promise<string> {
  /**
   * Namespace object so the default export can be returned.
   */
  const mod = await import('./sample.sql', { with: { type: 'text', }, });
  return mod.default;
}
