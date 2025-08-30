export function $(
  value: number,
): value is 0 {
  return value === 0;
}
