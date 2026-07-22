/**
 * Key naming for the localStorage persistence engine.
 *
 * localStorage is shared by every tab of the origin and survives restarts, so
 * unlike the per-tab sessionStorage keys (`monochromatic.log.{n}`), these keys
 * carry a run identity: `monochromatic.log.{stamp}.{nonce}.{index}`. The stamp
 * orders runs oldest-first for cross-run eviction, the nonce keeps two tabs
 * started in the same millisecond from colliding, and the index orders batches
 * within a run.
 *
 * @module
 */

/**
 * Prefix namespacing this logger's localStorage entries away from host
 * application keys.
 */
export const LOCAL_STORAGE_KEY_PREFIX = 'monochromatic.log';

/**
 * Parsed identity of one owned localStorage entry, used to order eviction
 * across runs.
 */
export type ParsedLogKey = {
  readonly key: string;
  readonly stamp: number;
  readonly nonce: string;
  readonly index: number;
};

/**
 * Reports whether `text` is one or more ASCII digits, so key parsing accepts
 * only counter-shaped segments and never claims a host application's key. A
 * linear scan instead of a regex: the rule is a plain character-range check.
 *
 * @param text - Candidate key segment.
 *
 * @returns Whether every character is an ASCII digit and one exists.
 */
function isDigits(text: string,): boolean {
  if (text.length === 0)
    return false;
  for (const character of text) {
    if ((character < '0') || (character > '9'))
      return false;
  }
  return true;
}

/**
 * Builds the namespaced localStorage key for one batch slot of one run.
 *
 * @param slot - Run identity plus zero-based batch index.
 *
 * @returns Key such as `monochromatic.log.1753000000000.a1b2.3`.
 *
 * @example
 * ```ts
 * buildLogKey({ stamp: 1753000000000, nonce: 'a1b2', index: 3 });
 * ```
 */
export function buildLogKey(
  {
    stamp,
    nonce,
    index,
  }: {
    readonly stamp: number;
    readonly nonce: string;
    readonly index: number;
  },
): string {
  return `${LOCAL_STORAGE_KEY_PREFIX}.${stamp}.${nonce}.${index}`;
}

/**
 * Parses a localStorage key back into its run identity, or reports it foreign.
 * Parsing is strict (exact prefix, exactly three dot segments, digit-shaped
 * stamp and index, non-empty nonce) because eviction trusts this to never
 * classify a host application's key, or the sessionStorage sink's flat
 * `monochromatic.log.{n}` shape, as evictable.
 *
 * @param key - Candidate localStorage key.
 *
 * @returns Parsed identity, or `undefined` for any key this engine must not
 * touch.
 *
 * @example
 * ```ts
 * parseLogKey('monochromatic.log.1753000000000.a1b2.3'); // ParsedLogKey
 * parseLogKey('monochromatic.log.5'); // undefined: sessionStorage shape
 * ```
 */
export function parseLogKey(key: string,): ParsedLogKey | undefined {
  if (!key.startsWith(`${LOCAL_STORAGE_KEY_PREFIX}.`,))
    return undefined;
  /**
   * Key remainder past the prefix and its trailing dot, holding the run
   * identity segments.
   */
  const rest = key.slice(LOCAL_STORAGE_KEY_PREFIX.length + 1,);
  /**
   * Dot-separated identity segments; exactly stamp, nonce, index for an owned
   * key.
   */
  const segments = rest.split('.',);
  if (segments.length !== 3)
    return undefined;
  const [stampText, nonce, indexText,] = segments;
  if ((stampText === undefined) || (nonce === undefined) || (indexText === undefined))
    return undefined;
  if (!isDigits(stampText,) || (nonce.length === 0) || !isDigits(indexText,))
    return undefined;
  return {
    key,
    stamp: Number.parseInt(stampText, 10,),
    nonce,
    index: Number.parseInt(indexText, 10,),
  };
}

/**
 * Orders parsed keys oldest-first for eviction: by run stamp, then by nonce
 * (an arbitrary but stable tiebreak between same-millisecond runs), then by
 * batch index within the run. Positional parameters because `Array.sort`
 * dictates the comparator signature.
 *
 * @param first - Parsed key compared first.
 *
 * @param second - Parsed key compared second.
 *
 * @returns Negative when `first` is older, positive when newer, zero on ties.
 *
 * @example
 * ```ts
 * entries.sort(compareLogKeys);
 * ```
 */
export function compareLogKeys(first: ParsedLogKey, second: ParsedLogKey,): number {
  if (first.stamp !== second.stamp)
    return first.stamp - second.stamp;
  if (first.nonce !== second.nonce)
    return (first.nonce < second.nonce) ? -1 : 1;
  return first.index - second.index;
}
