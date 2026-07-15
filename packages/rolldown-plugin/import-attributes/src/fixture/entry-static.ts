import query from './sample.sql' with { type: 'text', };

/**
 * Returns the statically imported SQL text so the bundle keeps the
 * static `import` declaration this fixture exercises alive and retains
 * the transformed specifier.
 *
 * @returns raw SQL content from `./sample.sql`
 *
 * @example
 * ```ts
 * const sql = getStaticQuery();
 * // sql holds raw contents of ./sample.sql
 * ```
 */
export function getStaticQuery(): string {
  return query;
}
