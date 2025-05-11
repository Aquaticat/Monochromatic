import type { MaybeAsyncIterable } from '@monochromatic-dev/module-es/ts';

/**
 Join an iterable of strings by separator.
 */
/* @__NO_SIDE_EFFECTS__ */ export async function joinStringsAsync(
  separator: string,
  strings: MaybeAsyncIterable<string>,
): Promise<string> {
  if (Array.isArray(strings)) {
    return strings.join(separator);
  }

  const stringsArr: string[] = await Array.fromAsync(strings);
  return stringsArr.join(separator);
}
/* @__NO_SIDE_EFFECTS__ */ export function joinStrings(
  separator: string,
  strings: Iterable<string>,
): string {
  if (Array.isArray(strings)) {
    return strings.join(separator);
  }

  const stringsArr: string[] = [...strings];
  return stringsArr.join(separator);
}
