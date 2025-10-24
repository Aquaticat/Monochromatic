import type {
  $ as StringJsonc,
  FragmentStringJsonc,
} from '@_/types/t string/t hasQuotedSyntax/t doubleQuote/t jsonc/t/index.ts';
import * as Jsonc from '../../../../t/index.ts';

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
 */
export function scanQuotedString(
  { value, }: { value: FragmentStringJsonc | StringJsonc },
): { consumed: FragmentStringJsonc; parsed: Jsonc.StringBase & Jsonc.ValueBase; remaining: FragmentStringJsonc } {
  if (!value.startsWith('"'))
    throw new Error('expected a double quote to start a JSON string');

  const findTerminatingQuote = (input: string, fromIndex: number): number => {
    // Mutable scan index and counter required for allocation-free O(n) traversal
    let consecutiveBackslashes = 0;
    for (let charIndex = fromIndex; charIndex < input.length; charIndex++) {
      const ch = input[charIndex];
      if (ch === '\\') {
        consecutiveBackslashes++;
        continue;
      }
      if (ch === '"') {
        if ((consecutiveBackslashes % 2) === 0)
          return charIndex; // unescaped terminator

        // escaped quote; reset and continue
        consecutiveBackslashes = 0;
        continue;
      }
      // non-backslash, non-quote resets the run
      consecutiveBackslashes = 0;
    }
    throw new Error('malformed jsonc, unterminated string');
  };

  const closingIndex = findTerminatingQuote(value, 1);
  const consumed = value.slice(0, closingIndex + 1) as FragmentStringJsonc;
  const remaining = value.slice(closingIndex + 1) as FragmentStringJsonc;
  return { consumed, parsed: { value: consumed }, remaining };
}
