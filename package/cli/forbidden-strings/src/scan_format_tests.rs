// What:     Unit tests for the five `scan_format` helpers
//           (`build_line_index`, `line_and_col_indexed`,
//           `end_in_line_indexed`, `format_hit`, `emit_hit`). This sidecar
//           file is pulled in by
//           `#[cfg(test)] #[path = "scan_format_tests.rs"] mod tests;` at
//           the bottom of `scan_format.rs`, so it compiles only under
//           `cargo nextest run` / `cargo test` and reaches the helpers via
//           `super::`.
// Why:      The four primitives and the composer each have invariants
//           documented in their Gotcha blocks. The format-hit shape is a
//           security-sensitive contract: the redacted output channel MUST
//           NEVER include the matched substring (see README "Redacted
//           output"). A silent change to any helper would either
//           re-introduce BUG 5 shaped behaviour (wrong line/col reports) or
//           worse, change the format string so the matched substring leaks.
//           These tests pin both shapes.

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
