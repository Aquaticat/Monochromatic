/**
 * @param input The input value to await. This can be any type, and the function will await it.
 * @return A Promise that resolves to the value obtained by awaiting the input.
 * @remarks Finds out the TypeScript type of the promise recursively.
 */
export async function awaits<T_input,>(
  input: T_input,
): Promise<Awaited<T_input>> {
  // noinspection ES6RedundantAwait
  return await input;
}
