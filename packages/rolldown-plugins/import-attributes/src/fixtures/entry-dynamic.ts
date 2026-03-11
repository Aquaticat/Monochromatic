export async function getQuery(): Promise<string> {
  const mod = await import('./sample.sql', { with: { type: 'text' } });
  return mod.default;
}
