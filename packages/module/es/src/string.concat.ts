// TODO: Handle the case user passes a single param of MaybeAsyncIterable<string>

/**
 Concats all the strings passed in as params into one string.
 There's no separator, or we could say the separator is ''.
 */
/* @__NO_SIDE_EFFECTS__ */ export function concatStrings(...strings: string[]): string {
  return strings.join('');
}
