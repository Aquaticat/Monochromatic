export function $(
  { strings, concatWith, }: { strings: string[]; concatWith: string; },
): string {
  return strings.join(concatWith,);
}
