/**
 * Dynamically imports a SQL file using `with { type: 'text' }` attribute.
 *
 * @returns raw SQL content as a string
 */
export async function getQuery(): Promise<string> {
  const mod = await import('./sample.sql', { with: { type: 'text', }, });
  return mod.default;
}
