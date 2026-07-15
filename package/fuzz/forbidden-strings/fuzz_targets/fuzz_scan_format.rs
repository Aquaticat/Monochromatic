// What:     `fuzz_scan_format` exercises the four primitives plus
//           `emit_hit` composer in `scan_format`. The key
//           soundness invariant (plan §7.5) is the negative one:
//           the formatted hit string must NEVER contain any of the
//           matched bytes from the content slice. A regression
//           here turns the redacted output into a leak surface.
// Why:      The hit format is the externally visible contract; a
//           subtle change that lets matched bytes through (e.g.
//           switching from offsets to substrings) would only show
//           up in production logs, where review is harder.

#![no_main]

use libfuzzer_sys::fuzz_target;

use arbitrary::{Arbitrary, Result, Unstructured};
use forbidden_strings::fuzz_api::*;

// What:     `#[derive(Debug)] pub struct ScanFormatInput { content,
//           start, end }`. Bundles a content slice with a (start,
//           end) byte range to format as a hit. Manual `Arbitrary`
//           so `end` is bounded above by `content.len()`.
// Why:      Avoid wasting iterations on out-of-range ranges that
//           the production scan path would never generate.
#[derive(Debug)]
struct ScanFormatInput {
    content: Vec<u8>,
    start: usize,
    end: usize,
    rule_idx: usize,
}

impl<'a> Arbitrary<'a> for ScanFormatInput {
    fn arbitrary(u: &mut Unstructured<'a>) -> Result<Self> {
        // What:     `let mut content: Vec<u8> = Vec::arbitrary(u)?;`
        //           Derived Arbitrary on `Vec<u8>` reads a leading
        //           length byte then that many payload bytes.
        // Why:      We want the content as raw bytes (not UTF-8
        //           restricted) so the boundary checks see real
        //           multi-byte chars and continuation bytes.
        let mut content: Vec<u8> = Vec::arbitrary(u)?;
        // Cap content length so iterations stay cheap.
        content.truncate(4096);
        let len = content.len();
        let start = if len == 0 {
            0
        } else {
            u.int_in_range(0usize..=(len - 1))?
        };
        let end = if len == 0 {
            0
        } else {
            u.int_in_range(start..=len)?
        };
        let rule_idx = u.int_in_range(0usize..=128)?;
        Ok(ScanFormatInput { content, start, end, rule_idx })
    }
}

fuzz_target!(|input: ScanFormatInput| {
    let content = input.content.as_slice();
    let start = input.start;
    let end = input.end;
    let rule_idx = input.rule_idx;

    // What:     `let line_starts = build_line_index(content);`. Pure
    //           function: returns a `Vec<usize>` of line-start byte
    //           offsets. Always starts at 0 unless content is
    //           empty (then it's `[]`).
    let line_starts = build_line_index(content);

    //region Invariant: line_starts is monotonically increasing

    for window in line_starts.windows(2) {
        assert!(
            window[0] < window[1],
            "line_starts not strictly increasing: {} vs {}",
            window[0],
            window[1],
        );
        assert!(
            window[1] <= content.len(),
            "line_starts entry {} exceeds content len {}",
            window[1],
            content.len(),
        );
    }
    if !line_starts.is_empty() {
        assert_eq!(line_starts[0], 0, "line_starts[0] must be 0");
    }

    //endregion

    if start >= content.len() {
        // Out-of-range start; format helpers may still be called
        // but the negative invariant below isn't meaningful.
        return;
    }

    // What:     `let (line, col_start) = line_and_col_indexed(&line_starts, start);`.
    //           Tuple destructure of the function's return. Both are
    //           1-indexed.
    let (line, col_start) = line_and_col_indexed(&line_starts, start);
    assert!(line >= 1, "line must be 1-indexed, got {}", line);
    assert!(col_start >= 1, "col_start must be 1-indexed, got {}", col_start);

    // What:     `let end_in_line = end_in_line_indexed(&line_starts, start, end);`.
    //           Clamps `end` to the first newline >= start, if any.
    let end_in_line = end_in_line_indexed(&line_starts, start, end);
    assert!(
        end_in_line >= start,
        "end_in_line {} < start {}",
        end_in_line,
        start,
    );
    assert!(
        end_in_line <= content.len(),
        "end_in_line {} exceeds content len {}",
        end_in_line,
        content.len(),
    );

    // What:     `let formatted = emit_hit(&line_starts, "fuzz.txt", start, end, rule_idx);`.
    //           Composer that runs the full sequence including
    //           `format_hit`.
    let formatted = emit_hit(&line_starts, "fuzz.txt", start, end, rule_idx);

    //region Invariant: formatted output never contains matched bytes

    // What:     If start < end and start < content.len() and
    //           end <= content.len(), the matched range is
    //           `content[start..end_in_line]`. The formatted string
    //           must NOT contain that byte slice anywhere.
    // Why:      Redaction contract. Plan §7.5 negative invariant.
    let matched_end = end_in_line.min(content.len());
    if start < matched_end {
        let matched = &content[start..matched_end];
        // Only check non-trivial matched ranges; a 0-byte slice
        // would trivially "appear" everywhere.
        if !matched.is_empty() {
            // What:     `let scaffold: Vec<u8> = ...`. The exact set of
            //           bytes `format_hit` can ever emit from its
            //           NON-content inputs: the fixed path passed to
            //           `emit_hit` above, the literal template chars
            //           (`:`, `..`, ` `, `rule=`), and decimal digits for
            //           the line/col/rule numbers. `Vec<u8>` is an owned,
            //           growable byte buffer (sibling: a borrowed `&[u8]`).
            // Why:      `format_hit` never receives the matched content,
            //           so it cannot interpolate it; redaction is
            //           structural. A short matched slice whose bytes all
            //           fall in this scaffolding alphabet can still appear
            //           in `formatted` by coincidence (a one-byte match of
            //           `9` inside `rule=99`, or `1` inside `1:1..1`),
            //           which is NOT a leak. Only a slice containing a
            //           byte OUTSIDE this alphabet proves the formatter
            //           interpolated content, so guard the window scan on
            //           that. The path literal must match the one passed
            //           to `emit_hit` above (`"fuzz.txt"`).
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const scaffold = new Set([...]);
            // const allScaffold = [...matched].every(b => scaffold.has(b));
            // ```
            let mut scaffold: Vec<u8> = b"fuzz.txt:.. rule=".to_vec();
            scaffold.extend(b'0'..=b'9');
            // What:     `matched.iter().all(|b| scaffold.contains(b))`.
            //           `.iter()` borrows the slice; `.all(closure)`
            //           returns `true` only if every byte satisfies the
            //           closure. `|b| ...` is a closure taking a `&u8`.
            // Why:      Decide whether a window hit could be coincidental
            //           scaffolding overlap (skip) or a real content leak.
            //
            // In TS you'd write (pseudocode):
            // ```ts
            // const allScaffold = matched.every(b => scaffold.has(b));
            // ```
            let matched_all_scaffold = matched.iter().all(|b| scaffold.contains(b));
            let formatted_bytes = formatted.as_bytes();
            // Window scan for the matched slice in the formatted string.
            // A hit is only a real leak when the matched slice is NOT
            // entirely scaffolding-alphabet bytes (otherwise the overlap
            // is coincidental, since format_hit cannot interpolate
            // content).
            if !matched_all_scaffold && matched.len() <= formatted_bytes.len() {
                for window in formatted_bytes.windows(matched.len()) {
                    if window == matched {
                        panic!(
                            "format_hit leaked matched bytes:\n\
                             formatted = {:?}\n\
                             matched_range = {}..{}\n\
                             matched_len = {}",
                            formatted,
                            start,
                            matched_end,
                            matched.len(),
                        );
                    }
                }
            }
        }
    }

    //endregion

    //region Invariant: shape of formatted output

    // The format is `path:line:col_start..col_end rule=N` -- check
    // the literal tokens are present.
    assert!(
        formatted.starts_with("fuzz.txt:"),
        "formatted hit doesn't start with path: {:?}",
        formatted,
    );
    assert!(
        formatted.contains(".."),
        "formatted hit missing '..': {:?}",
        formatted,
    );
    assert!(
        formatted.contains(" rule="),
        "formatted hit missing ' rule=': {:?}",
        formatted,
    );

    //endregion

    //region Invariant: explicit format_hit call

    // Also exercise `format_hit` directly with synthetic values
    // (decouples from emit_hit's column derivation).
    let (_, col_end) = line_and_col_indexed(
        &line_starts,
        if end_in_line > 0 { end_in_line - 1 } else { 0 },
    );
    let formatted2 = format_hit("fuzz.txt", line, col_start, col_end, rule_idx);
    assert_eq!(formatted, formatted2, "emit_hit and format_hit composition mismatch");

    //endregion
});
