import type {
  $ as StringJsonc,
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';
import type * as Jsonc from '../../../../t/index.ts';

/**
 * Finds the index of the terminating unescaped double quote in a JSON string.
 *
 * @param input - source string to scan
 *
 * @param fromIndex - position to begin scanning from
 *
 * @returns index of the closing double quote
 */
function findTerminatingQuote({
  input,
  fromIndex,
}: {
  input: string;
  fromIndex: number;
},): number {
  // Mutable scan counter held on an object so the function root stays const-only.
  /** Backslash run length carried across iterations to decide quote escaping by parity. */
  const scanState = { consecutiveBackslashes: 0, };
  for (let charIndex = fromIndex; charIndex < input.length; charIndex++) {
    /** Current input character under inspection in the scan loop. */
    const ch = input[charIndex];
    if (ch === '\\') {
      scanState.consecutiveBackslashes++;
      continue;
    }
    if (ch === '"') {
      if ((scanState.consecutiveBackslashes % 2) === 0)
        return charIndex; // unescaped terminator

      // escaped quote; reset and continue
      scanState.consecutiveBackslashes = 0;
      continue;
    }
    // non-backslash, non-quote resets the run
    scanState.consecutiveBackslashes = 0;
  }
  throw new Error('malformed jsonc, unterminated string',);
}

/**
 * Scan a JSONC string starting at a double quote and return consumed fragment, parsed value, and remaining tail.
 * Assumes the input begins with '"' and handles escaped quotes via backslash run-length parity.
 *
 * Performance: single-pass O(n) scan without substring allocation inside the hot loop.
 * Previous implementation used recursion plus `slice(0, idx)` and regex on each step, which could devolve to O(n^2).
 *
 * Why mutable counters: minimal `let` state (`charIndex`, `consecutiveBackslashes`) is required to traverse
 * the string efficiently and count backslashes adjacent to quotes without allocating intermediate strings.
 * This avoids GC pressure while preserving pure behaviour and API.
 *
 * @returns consumed fragment, parsed string value, and remaining tail
 *
 * @example
 * ```ts
 * const result = scanQuotedString({ value: '"hello" world' as FragmentStringJsonc });
 * // result.consumed === '"hello"'
 * // result.parsed.value === '"hello"'
 * // result.remaining === ' world'
 * ```
 */
export function scanQuotedString(
  { value, }: { value: FragmentStringJsonc | StringJsonc; },
): {
  consumed: FragmentStringJsonc;
  parsed: Jsonc.StringBase & Jsonc.ValueBase;
  remaining: FragmentStringJsonc;
} {
  if (!value.startsWith('"',))
    throw new Error('expected a double quote to start a JSON string',);

  /** Index of the terminating double quote located by the scan loop. */
  const closingIndex = findTerminatingQuote({
    input: value,
    fromIndex: 1,
  },);
  /* oxlint-disable typescript/no-unsafe-type-assertion -- slice of JSONC string remains a JSONC fragment */
  /** Consumed quoted span carried back in the fragment-branded form. */
  const consumed = value.slice(
    0,
    closingIndex + 1,
  ) as FragmentStringJsonc;
  /* oxlint-enable typescript/no-unsafe-type-assertion */
  /* oxlint-disable typescript/no-unsafe-type-assertion -- slice of JSONC string remains a JSONC fragment */
  /** Tail after the quoted span carried back in the fragment-branded form. */
  const remaining = value.slice(closingIndex + 1,) as FragmentStringJsonc;
  /* oxlint-enable typescript/no-unsafe-type-assertion */
  return {
    consumed,
    parsed: { value: consumed, },
    remaining,
  };
}
