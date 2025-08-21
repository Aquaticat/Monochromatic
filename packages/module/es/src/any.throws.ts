export function anyThrows(...params: unknown[]): void {
  throw new Error(JSON.stringify(params));
}
