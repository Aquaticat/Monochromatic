export function unknownsThrows(...params: unknown[]): void {
  throw new Error(JSON.stringify(params));
}
