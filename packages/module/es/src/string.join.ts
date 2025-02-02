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

  const stringsArr: string[] = [];
  for await (const stringElement of strings) {
    stringsArr.push(stringElement);
  }
  return stringsArr.join(separator);
}
/* @__NO_SIDE_EFFECTS__ */ export function joinStrings(
  separator: string,
  strings: Iterable<string>,
): string {
  if (Array.isArray(strings)) {
    return strings.join(separator);
  }

  const stringsArr: string[] = [];
  for (const stringElement of strings) {
    stringsArr.push(stringElement);
  }
  return stringsArr.join(separator);
}
