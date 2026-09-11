//region Textual change spans
// A contiguous string difference is never itself a semantic naming diagnosis.

/**
 * First high-surrogate unit in UTF-16.
 */
const HIGH_SURROGATE_START = '\uD800';
/**
 * Last high-surrogate unit in UTF-16.
 */
const HIGH_SURROGATE_END = '\uDBFF';
/**
 * First low-surrogate unit in UTF-16.
 */
const LOW_SURROGATE_START = '\uDC00';
/**
 * Last low-surrogate unit in UTF-16.
 */
const LOW_SURROGATE_END = '\uDFFF';

/**
 * Detects a boundary bisecting one UTF-16 surrogate pair.
 *
 * @param text - line whose boundary is checked
 *
 * @param offset - candidate string offset
 *
 * @returns Whether a shared boundary must be expanded by one unit
 *
 * @example
 * ```ts
 * betweenSurrogates({ text: '🐈', offset: 1 });
 * ```
 */
function betweenSurrogates({
  text,
  offset,
}: {
  readonly text: string;
  readonly offset: number;
},): boolean {
  if ((offset <= 0) || (offset >= text.length))
    return false;
  /**
   * Unit immediately before the boundary.
   */
  const previous = text[offset - 1] ?? '';
  /**
   * Unit immediately after the boundary.
   */
  const current = text[offset] ?? '';
  return (previous >= HIGH_SURROGATE_START) && (previous <= HIGH_SURROGATE_END)
    && (current >= LOW_SURROGATE_START)
    && (current <= LOW_SURROGATE_END);
}

/**
 * Measures the common prefix with mutation confined to this returned count.
 *
 * @param previous - predecessor line
 *
 * @param current - current line
 *
 * @returns Shared prefix ending outside surrogate pairs
 *
 * @example
 * ```ts
 * const prefix = sharedPrefix({ previous, current });
 * ```
 */
function sharedPrefix({ previous, current, }: {
  readonly previous: string;
  readonly current: string;
},): number {
  /**
   * Longest possible shared prefix.
   */
  const limit = Math.min(previous.length, current.length,);
  /**
   * Advancing code-unit boundary, returned after surrogate adjustment.
   */
  let prefix = 0;
  while (prefix < limit && previous[prefix] === current[prefix])
    prefix += 1;
  if (betweenSurrogates({ text: previous, offset: prefix, },)
    || betweenSurrogates({ text: current, offset: prefix, },)) {
    prefix -= 1;
  }
  return prefix;
}

/**
 * Measures the remaining common suffix without crossing the proven prefix.
 *
 * @param previous - predecessor line
 *
 * @param current - current line
 *
 * @param prefix - already consumed shared prefix
 *
 * @returns Shared suffix beginning outside surrogate pairs
 *
 * @example
 * ```ts
 * const suffix = sharedSuffix({ previous, current, prefix });
 * ```
 */
function sharedSuffix({ previous, current, prefix, }: {
  readonly previous: string;
  readonly current: string;
  readonly prefix: number;
},): number {
  /**
   * Maximum remaining shared suffix.
   */
  const limit = Math.min(previous.length, current.length,) - prefix;
  /**
   * Advancing suffix boundary, returned after surrogate adjustment.
   */
  let suffix = 0;
  while (suffix < limit
    && previous[previous.length - suffix - 1] === current[current.length - suffix - 1]) {
    suffix += 1;
  }
  if (betweenSurrogates({ text: previous, offset: previous.length - suffix, },)
    || betweenSurrogates({ text: current, offset: current.length - suffix, },)) {
    suffix -= 1;
  }
  return suffix;
}

/**
 * Finds a minimal contiguous textual change without splitting code points.
 * Linear scans consume common ends once; no recursion or accumulator rebuilding.
 * The caller still must prove the entire changed span is a classified reference.
 *
 * @param previous - exact normalized predecessor line
 *
 * @param current - exact normalized current line
 *
 * @returns Shared-prefix offset and the two changed fragments
 *
 * @example
 * ```ts
 * const change = archiveChangedSpan({ previous: 'met 猫', current: 'met Cat' });
 * ```
 */
export function archiveChangedSpan({
  previous,
  current,
}: {
  readonly previous: string;
  readonly current: string;
},): {
  readonly start: number;
  readonly removed: string;
  readonly added: string
} {
  /**
   * Proven shared prefix, no longer mutable during suffix construction.
   */
  const prefix = sharedPrefix({ previous, current, },);
  /**
   * Shared suffix cannot overlap that prefix.
   */
  const suffix = sharedSuffix({ previous, current, prefix, },);
  return {
    start: prefix,
    removed: previous.slice(
      prefix,
      previous.length - suffix,
    ),
    added: current.slice(
      prefix,
      current.length - suffix,
    ),
  };
}

//endregion Textual change spans
