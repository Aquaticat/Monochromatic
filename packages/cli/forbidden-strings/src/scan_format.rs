// What:     `use memchr::memchr_iter;` imports a SIMD-accelerated
//           "find every occurrence of byte B in slice S" iterator.
//           memchr is the foundation that aho-corasick is also built
//           on, so this dep is essentially free in our build.
// Why:      `build_line_index` walks every byte of one file and
//           records the offset of each `\n`. memchr_iter does that
//           with AVX2/NEON (when available) instead of byte-at-a-time
//           scalar code, so a 1M-line file builds the index in
//           milliseconds instead of tens of milliseconds.
// TS map:   No 1:1 equivalent. Closest is `String.prototype.matchAll`
//           with a `/\n/g` regex, but that is slower than SIMD memchr.
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
// TS map:   `function buildLineIndex(content: Uint8Array): number[]`.
// Gotcha:   The returned vec's length is `1 + count(\\n in content)`,
//           NOT the visible line count when the file ends without a
//           trailing newline. The last entry can equal `content.len()`
//           when the file ends with `\n`; lookups must tolerate that.
//
// In TS you'd write (pseudocode):
// ```ts
// function buildLineIndex(content: Uint8Array): number[] {
//   const starts = [0];
//   for (let i = 0; i < content.length; i++) {
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
    // TS map:   No equivalent; JS arrays auto-grow with amortised O(1).
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
    // TS map:   No 1:1; mentally `[...content].flatMap((b, i) => b===10 ? [i] : [])`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (let i = 0; i < content.length; i++) {
    //   if (content[i] === 0x0a) starts.push(i + 1);
    // }
    // ```
    for nl in memchr_iter(b'\n', content) {
        starts.push(nl + 1);
    }
    starts
}

// What:     `pub fn line_and_col_indexed(line_starts: &[usize], offset: usize) -> (usize, usize)`
//           is the indexed replacement for the old `line_and_col`. It
//           does an O(log L) binary search instead of an O(offset)
//           walk to find which line owns `offset`.
// Why:      Same `(line, col)` output as before; faster when called
//           many times on one file because the index is shared.
// TS map:   `function lineAndColIndexed(lineStarts: number[], offset: number): [number, number]`.
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
    // TS map:   See pseudocode above; TS has no `partition_point`,
    //           hand-rolled binary search needed.
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

// What:     `pub fn end_in_line_indexed(line_starts: &[usize], start: usize, end: usize) -> usize`
//           returns the byte offset of the first `\n` in `[start, end)`
//           if one exists, else returns `end` unchanged. Indexed
//           replacement for the old `end_in_line`.
// Why:      Same semantics as before -- clamping multi-line matches
//           to one line for the report. Now O(log L) instead of
//           O(end - start).
// TS map:   `function endInLineIndexed(lineStarts: number[], start: number, end: number): number`.
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

// What:     `pub fn format_hit(path, line, col_start, col_end, rule_idx) -> String`
//           builds the redacted `path:line:col_start..col_end rule=N`
//           output string. Public so `scan.rs` can call it.
// Why:      Output format must NEVER include the matched substring --
//           the failing CI log itself is a leak surface. Centralizing
//           the format string here ensures every hit is redacted the
//           same way.
// TS map:   `function formatHit(path: string, line: number, colStart: number, colEnd: number, ruleIdx: number): string`.
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
// TS map:   `function emitHit(li: number[], path: string, start: number, end: number, ruleIdx: number): string`.
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

// What:     Inline `#[cfg(test)] mod tests` covering the five publics
//           above. Tests live next to the helpers (one file, one module)
//           because scan_format.rs is short and the helpers are leaf
//           utilities -- no cross-module fixtures to share, no
//           pub(super) visibility hops to set up. Compiles only under
//           `cargo test`, costs nothing in the release binary.
// Why:      The four primitives (build_line_index, line_and_col_indexed,
//           end_in_line_indexed, format_hit) and the composer (emit_hit)
//           each have invariants documented in their Gotcha blocks
//           above. The format-hit shape is a security-sensitive
//           contract: the redacted output channel MUST NEVER include
//           the matched substring (see README "Redacted output"). A
//           silent change to any helper would either re-introduce BUG 5
//           shaped behaviour (wrong line/col reports) or worse, change
//           the format string so the matched substring leaks. These
//           tests pin both shapes.
// TS map:   `describe("scan_format helpers", () => { ... })`.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("scan_format helpers", () => { /* tests below */ });
// ```
#[cfg(test)]
mod tests {
    use super::build_line_index;
    use super::emit_hit;
    use super::end_in_line_indexed;
    use super::format_hit;
    use super::line_and_col_indexed;

    // What:     `build_line_index` on an empty input must still return
    //           `[0]`. The comment promises "first entry is always 0";
    //           every consumer (`line_and_col_indexed`,
    //           `end_in_line_indexed`) reads `line_starts[0]` without a
    //           bounds check.
    // Why:      Guards the partition_point/saturating_sub invariant.
    //           Remove the leading `starts.push(0)` and every other
    //           helper panics on first call.
    #[test]
    fn build_line_index_empty_content_yields_single_zero() {
        let li = build_line_index(b"");
        assert_eq!(li, vec![0]);
    }

    #[test]
    fn build_line_index_content_without_newline_yields_single_zero() {
        let li = build_line_index(b"abc");
        assert_eq!(li, vec![0]);
    }

    // What:     "abc\ndef" -- one `\n` at byte 3, so the index is
    //           [0, 4]. Length 2, NOT 3, because the file ends without
    //           a trailing newline.
    // Why:      Explicit "Gotcha" in `build_line_index`: the vec length
    //           is `1 + count(\n)`, not the visible line count. Pair
    //           this with the trailing-newline test to catch any future
    //           refactor that "fixes" the asymmetry.
    #[test]
    fn build_line_index_two_lines_no_trailing_newline_has_length_two() {
        let li = build_line_index(b"abc\ndef");
        assert_eq!(li, vec![0, 4]);
    }

    // What:     "abc\ndef\n" -- two `\n`, so the index is [0, 4, 8] and
    //           the final entry equals `content.len()`. Downstream
    //           lookups must tolerate that (see `end_in_line_indexed`'s
    //           `next_line_start > 0` guard).
    // Why:      The "trailing-newline produces len-equal entry" branch
    //           is what motivates the > 0 guard; locking this in stops
    //           a future refactor from removing the guard on the
    //           assumption that the last entry never equals len.
    #[test]
    fn build_line_index_two_lines_with_trailing_newline_includes_len() {
        let content: &[u8] = b"abc\ndef\n";
        let li = build_line_index(content);
        assert_eq!(li, vec![0, 4, 8]);
        assert_eq!(li[li.len() - 1], content.len());
    }

    #[test]
    fn build_line_index_consecutive_newlines_produce_consecutive_entries() {
        let li = build_line_index(b"\n\n");
        assert_eq!(li, vec![0, 1, 2]);
    }

    // What:     `build_line_index` counts only `\n`. "abc\r\ndef" has
    //           one `\n` at byte 4, so the index is [0, 5]; the `\r`
    //           sits inside line 1 and column counting includes it.
    // Why:      Lock in current CRLF semantics. The scanner reports raw
    //           byte columns -- it does not normalise CRLF -- so a CRLF
    //           file's line-2-col-1 is the byte after `\n`. If we ever
    //           switch to CRLF-aware indexing (count `\r\n` as one
    //           separator), this test breaks and forces a deliberate
    //           update.
    #[test]
    fn build_line_index_crlf_treats_only_lf_as_line_separator() {
        let li = build_line_index(b"abc\r\ndef");
        assert_eq!(li, vec![0, 5]);
    }

    // What:     Pins the saturating_sub invariant. `build_line_index`
    //           always pushes 0 first, so for any valid offset the
    //           predicate `|&s| s <= offset` is true at index 0,
    //           partition_point >= 1, and saturating_sub is just
    //           `result - 1`. The saturation branch is effectively
    //           unreachable.
    // Why:      If a future refactor removes the leading `starts.push(0)`,
    //           partition_point at offset 0 returns 0, saturating_sub
    //           pins it at 0, then `line_starts[0]` panics on the empty
    //           slice. This test fails first by returning a wrong shape
    //           before the panic path; pairs with the empty-input test
    //           above.
    #[test]
    fn line_and_col_indexed_offset_zero_is_line_one_col_one() {
        let li = build_line_index(b"abc\ndef");
        assert_eq!(line_and_col_indexed(&li, 0), (1, 1));
    }

    #[test]
    fn line_and_col_indexed_offset_on_first_line_returns_correct_col() {
        let li = build_line_index(b"abc\ndef");
        assert_eq!(line_and_col_indexed(&li, 2), (1, 3));
    }

    // What:     Offset 3 is the `\n` byte itself in "abc\ndef". By the
    //           "line owns the byte at offset" rule (partition_point on
    //           `s <= offset` with line_starts=[0,4] at offset 3 yields
    //           1, saturating_sub gives line_idx 0), the newline byte
    //           belongs to line 1.
    // Why:      A regression that switched the predicate to `s < offset`
    //           would misattribute the `\n` to line 2 col 0.
    #[test]
    fn line_and_col_indexed_offset_at_newline_byte_stays_on_first_line() {
        let li = build_line_index(b"abc\ndef");
        assert_eq!(line_and_col_indexed(&li, 3), (1, 4));
    }

    #[test]
    fn line_and_col_indexed_offset_after_newline_is_next_line_col_one() {
        let li = build_line_index(b"abc\ndef");
        assert_eq!(line_and_col_indexed(&li, 4), (2, 1));
    }

    #[test]
    fn line_and_col_indexed_offset_on_third_line_returns_correct_line_and_col() {
        let li = build_line_index(b"abc\ndef\nghi");
        assert_eq!(line_and_col_indexed(&li, 9), (3, 2));
    }

    #[test]
    fn end_in_line_indexed_single_line_returns_end_unchanged() {
        let li = build_line_index(b"abcdef");
        assert_eq!(end_in_line_indexed(&li, 0, 6), 6);
    }

    // What:     Match span [0, 6) in "abc\ndef" would cross the `\n` at
    //           byte 3. `end_in_line_indexed` clamps to the newline
    //           position itself, returning 3 (one-past-end of the
    //           reported portion on line 1).
    // Why:      Multi-line matches are reported as their first-line
    //           portion; this is the core invariant that keeps
    //           `path:line:col_start..col_end` referring to a single
    //           source line.
    #[test]
    fn end_in_line_indexed_clamps_to_newline_when_match_spans_lines() {
        let li = build_line_index(b"abc\ndef");
        assert_eq!(end_in_line_indexed(&li, 0, 6), 3);
    }

    #[test]
    fn end_in_line_indexed_end_before_newline_returns_end_unchanged() {
        let li = build_line_index(b"abcdef\nghi");
        assert_eq!(end_in_line_indexed(&li, 0, 3), 3);
    }

    // What:     Empty span (start == end). The function must return
    //           `end` cleanly. `emit_hit`'s Gotcha says the three regex
    //           emission sites in scan.rs guard `start == end` BEFORE
    //           calling emit_hit, but the helper itself should not
    //           panic or return a negative-shaped value if a guard is
    //           ever missed.
    // Why:      Defence in depth around the redacted-output contract;
    //           an empty span that produced a wrong col_end could
    //           silently widen reported columns.
    #[test]
    fn end_in_line_indexed_empty_span_returns_end() {
        let li = build_line_index(b"abc\ndef");
        assert_eq!(end_in_line_indexed(&li, 2, 2), 2);
    }

    // What:     The full format contract: `path:line:col_start..col_end
    //           rule=N`. The matched substring MUST NOT appear; this
    //           test pins the exact shape every consumer relies on.
    // Why:      Output format is a security-sensitive contract (see
    //           README "Redacted output"). A regression that interpolated
    //           even one byte of matched content into the format string
    //           would turn the CI log into a leak surface; pinning the
    //           five-field shape detects any such accidental widening.
    #[test]
    fn format_hit_produces_expected_redacted_shape() {
        let s = format_hit("src/foo.rs", 42, 5, 11, 7);
        assert_eq!(s, "src/foo.rs:42:5..11 rule=7");
    }

    #[test]
    fn format_hit_handles_one_indexed_minimum() {
        let s = format_hit("a", 1, 1, 1, 0);
        assert_eq!(s, "a:1:1..1 rule=0");
    }

    // What:     `emit_hit` composes line_and_col_indexed (twice) and
    //           end_in_line_indexed with format_hit. For "abc\ndef\nghi"
    //           and match [4, 7) (the literal "def" on line 2), the
    //           expected output is `f.txt:2:1..3 rule=3`.
    // Why:      Bugs in the composition (e.g. the `if end_in_line > 0`
    //           branch, the off-by-one on `end_in_line - 1`) survive
    //           unit tests of the underlying primitives. emit_hit is
    //           the function scan.rs actually calls; it deserves
    //           coverage in its own right.
    #[test]
    fn emit_hit_composes_line_col_and_format_for_single_line_match() {
        let content = b"abc\ndef\nghi";
        let li = build_line_index(content);
        let s = emit_hit(&li, "f.txt", 4, 7, 3);
        assert_eq!(s, "f.txt:2:1..3 rule=3");
    }

    // What:     Span [0, 7) in "abc\ndef" would cross the `\n` at byte
    //           3. emit_hit must clamp col_end to within line 1 (3
    //           characters: cols 1..3).
    // Why:      Locks in the multi-line clamp through the full
    //           composition path, not just `end_in_line_indexed` in
    //           isolation.
    #[test]
    fn emit_hit_clamps_multi_line_match_to_first_line() {
        let content = b"abc\ndef";
        let li = build_line_index(content);
        let s = emit_hit(&li, "f.txt", 0, 7, 1);
        assert_eq!(s, "f.txt:1:1..3 rule=1");
    }

    // What:     `emit_hit`'s `if end_in_line > 0 { end_in_line - 1 } else
    //           { 0 }` branch matters when the match starts at offset
    //           0 and is a single byte (end == 1). end_in_line is 1;
    //           the subtraction yields 0; line_and_col_indexed at
    //           offset 0 returns (1, 1).
    // Why:      Off-by-one regressions in the composition would shift
    //           col_end by 1 here, producing `f.txt:1:1..0` (nonsense)
    //           or `f.txt:1:1..2` (overshoot).
    #[test]
    fn emit_hit_handles_single_byte_match_at_offset_zero() {
        let content = b"abc";
        let li = build_line_index(content);
        let s = emit_hit(&li, "f.txt", 0, 1, 0);
        assert_eq!(s, "f.txt:1:1..1 rule=0");
    }
}
