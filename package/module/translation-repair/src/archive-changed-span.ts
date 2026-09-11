//region Textual change spans
// A contiguous string difference is never itself a semantic naming diagnosis.

/** First high-surrogate unit in UTF-16. */
const HIGH_SURROGATE_START = '\uD800';
/** Last high-surrogate unit in UTF-16. */
const HIGH_SURROGATE_END = '\uDBFF';
/** First low-surrogate unit in UTF-16. */
const LOW_SURROGATE_START = '\uDC00';
/** Last low-surrogate unit in UTF-16. */
const LOW_SURROGATE_END = '\uDFFF';

/**
 * Detects a boundary bisecting one UTF-16 surrogate pair.
 *
 * @param text - line whose boundary is checked
 * @param offset - candidate string offset
 * @returns Whether a shared boundary must be expanded by one unit
 * @example
 * ```ts
 * betweenSurrogates({ text: '🐈', offset: 1 });
 * ```
 */
function betweenSurrogates({ text, offset, }: {
  readonly text: string;
  readonly offset: number;
},): boolean {
  if (offset <= 0 || offset >= text.length)
    return false;
  /** Unit immediately before the boundary. */
  const previous = text[offset - 1] ?? '';
  /** Unit immediately after the boundary. */
  const current = text[offset] ?? '';
  return previous >= HIGH_SURROGATE_START && previous <= HIGH_SURROGATE_END
    && current >= LOW_SURROGATE_START && current <= LOW_SURROGATE_END;
}

/**
 * Finds a minimal contiguous textual change without splitting code points.
 * Linear scans consume common ends once; no recursion or accumulator rebuilding.
 * The caller still must prove the entire changed span is a classified reference.
 *
 * @param previous - exact normalized predecessor line
 * @param current - exact normalized current line
 * @returns Shared-prefix offset and the two changed fragments
 * @example
 * ```ts
 * const change = archiveChangedSpan({ previous: 'met 猫', current: 'met Cat' });
 * ```
 */
export function archiveChangedSpan({ previous, current, }: {
  readonly previous: string;
  readonly current: string;
},): { readonly start: number; readonly removed: string; readonly added: string; } {
  /** Maximum shared-end extent before the prefix is known. */
  const limit = Math.min(previous.length, current.length,);
  /** Common prefix length, adjusted away from a surrogate-pair interior. */
  let prefix = 0;
  while (prefix < limit && previous[prefix] === current[prefix])
    prefix += 1;
  if (betweenSurrogates({ text: previous, offset: prefix, },)
    || betweenSurrogates({ text: current, offset: prefix, },)) {
    prefix -= 1;
  }
  /** Common suffix cannot overlap the established prefix. */
  let suffix = 0;
  while (suffix < limit - prefix
    && previous[previous.length - suffix - 1] === current[current.length - suffix - 1]) {
    suffix += 1;
  }
  if (betweenSurrogates({ text: previous, offset: previous.length - suffix, },)
    || betweenSurrogates({ text: current, offset: current.length - suffix, },)) {
    suffix -= 1;
  }
  return { start: prefix,
    removed: previous.slice(prefix, previous.length - suffix,),
    added: current.slice(prefix, current.length - suffix,), };
}

//endregion Textual change spans
