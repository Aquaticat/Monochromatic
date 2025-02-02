/* @__NO_SIDE_EFFECTS__ */ export async function awaits<T_input,>(
  input: T_input,
): Promise<Awaited<T_input>> {
  return await input;
}
