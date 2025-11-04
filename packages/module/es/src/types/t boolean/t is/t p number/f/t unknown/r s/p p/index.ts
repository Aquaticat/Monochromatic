// Includes NaN

export function $(
  value: unknown,
): value is number {
  return typeof value === 'number';
}
