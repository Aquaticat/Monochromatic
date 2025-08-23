export function $(value: unknown): value is string {
  return typeof value === 'string';
}
