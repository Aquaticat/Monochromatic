//! scan_format support for the forbidden-strings scanner.
/// Imports dependencies used by this module.
// What:     `use memchr::memchr_iter;` imports a SIMD-accelerated
//           "find every occurrence of byte B in slice S" iterator.
//           memchr is the foundation that aho-corasick is also built
//           on, so this dep is essentially free in our build.
// Why:      `build_line_index` walks every byte of one file and
//           records the offset of each `\n`. memchr_iter does that
//           with AVX2/NEON (when available) instead of byte-at-a-time
//           scalar code, so a 1M-line file builds the index in
//           milliseconds instead of tens of milliseconds.
//
// In TS you'd write (pseudocode):
// ```ts
// // No equivalent. Imagine:
// // for (const m of content.matchAll(/\n/g)) starts.push(m.index + 1);
// ```
use memchr::memchr_iter;

// What:     The previous `is_likely_binary` heuristic lived here. It
//           was removed (see BUG 5): a NUL byte in the first 8 KiB
//           caused the entire scan to short-circuit, producing silent
//           false negatives when a deny-listed literal appeared before
//           a NUL in the file. AC scans raw bytes content-agnostic and
//           the redacted output format makes a "binary file leaks
//           secret" report useful; the perf saving from skipping
//           binaries does not justify the soundness gap.

/// Implements `build_line_index`.
// What:     `pub fn build_line_index(content: &[u8]) -> Vec<usize>`
//           produces a sorted `Vec<usize>` of byte offsets where each
//           line starts. The first entry is always `0` (line 1's start);
//           subsequent entries are the offset of the byte JUST AFTER
//           each `\n`. So a file `"abc\ndef"` yields `[0, 4]` --
//           line 1 begins at 0, line 2 begins at 4.
// Why:      Replacing the old per-hit byte walk with an O(n)-once index
//           plus O(log L) lookups (L = line count). The win matters
//           when a single file has many hits -- e.g. an agent that
//           wrote a forbidden literal a million times: 2M walks of
//           average length n/2 collapse to one O(n) build plus 2M
//           binary searches. Building only happens lazily on the
//           first hit, so 99%-clean files never pay this cost.
// Gotcha:   The returned vec's length is `1 + count(\\n in content)`,
//           NOT the visible line count when the file ends without a
//           trailing newline. The last entry can equal `content.len()`
//           when the file ends with `\n`; lookups must tolerate that.
//
// In TS you'd write (pseudocode):
// ```ts
// function buildLineIndex(content: Uint8Array): number[] {
//   const starts = [0];
//   for (let loopIndex = 0; loopIndex < content.length; loopIndex++) {
//     if (content[i] === 0x0a) starts.push(i + 1);
//   }
//   return starts;
// }
// ```
pub fn build_line_index(content: &[u8]) -> Vec<usize> {
    // What:     `Vec::with_capacity(n)` pre-allocates n slots so push
    //           does not have to grow the buffer for the first n
    //           entries. We estimate n from average line length ~32.
    // Why:      Avoid quadratic copy cost on grow for very long files.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const starts: number[] = [];
    // ```
    let mut starts: Vec<usize> = Vec::with_capacity(content.len() / 32 + 1);
    starts.push(0);
    // What:     `memchr_iter(b'\n', content)` returns a SIMD-accelerated
    //           iterator over every byte position of `\n` in `content`.
    //           `b'\n'` is a byte literal (`u8` value 10).
    // Why:      Hot loop; SIMD beats scalar by 4-8x on long inputs.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (let loopIndex = 0; loopIndex < content.length; loopIndex++) {
    //   if (content[i] === 0x0a) starts.push(i + 1);
    // }
    // ```
    for nl in memchr_iter(b'\n', content) {
        starts.push(nl + 1);
    }
    starts
}

/// Implements `line_and_col_indexed`.
// What:     `pub fn line_and_col_indexed(line_starts: &[usize], offset: usize) -> (usize, usize)`
//           is the indexed replacement for the old `line_and_col`. It
//           does an O(log L) binary search instead of an O(offset)
//           walk to find which line owns `offset`.
// Why:      Same `(line, col)` output as before; faster when called
//           many times on one file because the index is shared.
//
// In TS you'd write (pseudocode):
// ```ts
// function lineAndColIndexed(lineStarts: number[], offset: number): [number, number] {
//   // partition_point: first index whose value is > offset
//   let lo = 0, hi = lineStarts.length;
//   while (lo < hi) {
//     const mid = (lo + hi) >> 1;
//     if (lineStarts[mid] <= offset) lo = mid + 1; else hi = mid;
//   }
//   const lineIdx = Math.max(0, lo - 1);
//   return [lineIdx + 1, offset - lineStarts[lineIdx] + 1];
// }
// ```
pub fn line_and_col_indexed(line_starts: &[usize], offset: usize) -> (usize, usize) {
    // What:     `slice.partition_point(pred)` returns the first index
    //           where `pred` becomes false (assuming the slice is
    //           "false-then-true" partitioned by `pred`). For a sorted
    //           ascending slice and the predicate `|s| s <= offset`,
    //           this gives one past the last index whose value is
    //           `<= offset`. `saturating_sub(1)` is "subtract 1 but
    //           don't underflow `usize`" -- when the predicate is
    //           false at index 0 the result is 0 instead of wrapping.
    // Why:      Find the largest line-start that is <= offset; that
    //           line owns the byte at `offset`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const lineIdx = Math.max(0, (lo) - 1);
    // ```
    let line_idx = line_starts
        .partition_point(|&s| s <= offset)
        .saturating_sub(1);
    let line = line_idx + 1;
    let col = offset - line_starts[line_idx] + 1;
    (line, col)
}

/// Implements `end_in_line_indexed`.
// What:     `pub fn end_in_line_indexed(line_starts: &[usize], start: usize, end: usize) -> usize`
//           returns the byte offset of the first `\n` in `[start, end)`
//           if one exists, else returns `end` unchanged. Indexed
//           replacement for the old `end_in_line`.
// Why:      Same semantics as before -- clamping multi-line matches
//           to one line for the report. Now O(log L) instead of
//           O(end - start).
//
// In TS you'd write (pseudocode):
// ```ts
// function endInLineIndexed(lineStarts: number[], start: number, end: number): number {
//   const lineIdx = Math.max(0, partitionPoint(lineStarts, s => s <= start) - 1);
//   if (lineIdx + 1 < lineStarts.length) {
//     const nextLineStart = lineStarts[lineIdx + 1];
//     if (nextLineStart > 0 && nextLineStart - 1 < end) return nextLineStart - 1;
//   }
//   return end;
// }
// ```
pub fn end_in_line_indexed(line_starts: &[usize], start: usize, end: usize) -> usize {
    let line_idx = line_starts
        .partition_point(|&s| s <= start)
        .saturating_sub(1);
    if line_idx + 1 < line_starts.len() {
        let next_line_start = line_starts[line_idx + 1];
        if next_line_start > 0 && next_line_start - 1 < end {
            return next_line_start - 1;
        }
    }
    end
}

/// Implements `format_hit`.
// What:     `pub fn format_hit(path, line, col_start, col_end, rule_idx) -> String`
//           builds the redacted `path:line:col_start..col_end rule=N`
//           output string. Public so `scan.rs` can call it.
// Why:      Output format must NEVER include the matched substring --
//           the failing CI log itself is a leak surface. Centralizing
//           the format string here ensures every hit is redacted the
//           same way.
//
// In TS you'd write (pseudocode):
// ```ts
// function formatHit(path, line, colStart, colEnd, ruleIdx) {
//   return `${path}:${line}:${colStart}..${colEnd} rule=${ruleIdx}`;
// }
// ```
pub fn format_hit(
    path: &str,
    line: usize,
    col_start: usize,
    col_end: usize,
    rule_idx: usize,
) -> String {
    format!("{}:{}:{}..{} rule={}", path, line, col_start, col_end, rule_idx)
}

/// Implements `emit_hit`.
// What:     `pub fn emit_hit(li, path, start, end, rule_idx) -> String`
//           composes the three-step (line, col_start, col_end) compute
//           and `format_hit` call that every hit-emission site in
//           `scan.rs` previously inlined. Takes `&[usize]` (the
//           already-initialised line-start index) so the lazy
//           `OnceLock::get_or_init` invariant stays at each call site.
// Why:      `scan.rs::scan_content` emits hits from four near-identical
//           code paths (AC literal, prefix-matched par_iter, residual
//           Single shard, residual Combined par_iter). Each previously
//           spelled out: `line_and_col_indexed` for start, then
//           `end_in_line_indexed` to clamp multi-line matches to one
//           line, then a second `line_and_col_indexed` on `end - 1` (or
//           0 when `end` is 0) to derive col_end, then `format_hit`.
//           Centralising the sequence here removes ~60 logic lines from
//           `scan.rs` and ensures every site emits the same
//           `path:line:col_start..col_end rule=N` shape. `#[inline]`
//           guarantees the helper compiles to the same machine code the
//           inlined version produced (private to this crate, called
//           from one consumer, LTO already inlines tiny crate-internal
//           helpers, but the attribute removes any doubt on the hot
//           path).
// Gotcha:   This helper does NOT skip empty-span matches (`start ==
//           end`). The three regex-result emission sites in scan.rs
//           guard that with `if m.start == m.end { continue; }` before
//           calling emit_hit; the AC literal site does not need the
//           guard because AC patterns are non-empty by construction.
//           Keeping the guard at the call site preserves that
//           asymmetry and lets the `continue` skip the push entirely
//           instead of building a hit string we would discard.
//
// In TS you'd write (pseudocode):
// ```ts
// function emitHit(li, path, start, end, ruleIdx) {
//   const [line, colStart] = lineAndColIndexed(li, start);
//   const endInLine = endInLineIndexed(li, start, end);
//   const [, colEnd] = lineAndColIndexed(li, endInLine > 0 ? endInLine - 1 : 0);
//   return formatHit(path, line, colStart, colEnd, ruleIdx);
// }
// ```
#[inline]
pub fn emit_hit(
    li: &[usize],
    path: &str,
    start: usize,
    end: usize,
    rule_idx: usize,
) -> String {
    let (line, col_start) = line_and_col_indexed(li, start);
    let end_in_line = end_in_line_indexed(li, start, end);
    let (_, col_end) =
        line_and_col_indexed(li, if end_in_line > 0 { end_in_line - 1 } else { 0 });
    format_hit(path, line, col_start, col_end, rule_idx)
}

/// Registers the `tests` child module.
// What:     `#[cfg(test)] #[path = "scan_format_tests.rs"] mod tests;`
//           declares a test-only submodule whose code lives in the sibling
//           file `scan_format_tests.rs`. `#[cfg(test)]` gates it to test
//           builds only; `#[path = "..."]` aims the module at a flat
//           sibling file instead of the default `scan_format/tests.rs`
//           subdirectory lookup. The file stays the `tests` CHILD of
//           `scan_format`, so its `use super::*` reaches the leaf helpers
//           above unchanged.
// Why:      Keep `scan_format.rs` to its production helpers; the
//           invariant-pinning tests live beside it without inflating this
//           file or its max-lines budget (sibling `*_tests.rs` are exempt).
//
// In TS you'd write (pseudocode):
// ```ts
// // scan_format.unit.test.ts, run only by the test runner
// ```
#[cfg(test)]
#[path = "scan_format_tests.rs"]
mod tests;
