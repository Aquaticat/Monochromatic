// What:     Unit tests for `super::atom::walk_literal_bytes`. Lives
//           in a sibling module so it can reach the `pub(super)`
//           function via `super::atom::...` (sibling modules under
//           the same parent share that visibility scope).
// Why:      Compile-time gated by `#[cfg(test)]` in the parent module
//           (`rule.rs`), so this file contributes nothing to the
//           release binary. Keeping tests in a separate file (rather
//           than inline `mod tests` in `atom.rs`) preserves the
//           production file's focus.
//
// In TS you'd write (pseudocode):
// ```ts
// import { walkLiteralBytes } from "./atom";
// describe("walkLiteralBytes", () => { ... });
// ```

// What:     `use super::atom::walk_literal_bytes;` brings the
//           function under test into scope. `super` refers to the
//           parent module (`crate::rules`); `atom` is its sibling
//           submodule.
// Why:      Avoid writing the full path at every call site.
//
// In TS you'd write (pseudocode):
// ```ts
// import { walkLiteralBytes } from "./atom";
// ```
use super::atom::walk_literal_bytes;

// What:     `struct Case { ... }` is a record type with four owned
//           fields:
//           - `input: &'static str`. A borrowed slice of bytes baked
//             into the binary at compile time. Sibling: `String`,
//             which would be heap-allocated and owned. We use
//             `&'static str` because all our test cases are literals.
//           - `expected_out: &'static str`. Same.
//           - `expected_remainder: &'static str`. Same.
//           - `expected_out_bytes: &'static [u8]`. A borrowed slice
//             of bytes (NOT a `Vec<u8>` which would be owned/heap).
//             We use this to assert the exact UTF-8 byte sequence
//             of `out`, catching any mojibake regression that a
//             string-equality check might miss.
// Why:      Group the four fixture values per case so the table
//           below stays one-row-per-case. Naming over a tuple
//           because four positional fields would be illegible.
//
// In TS you'd write (pseudocode):
// ```ts
// type Case = { input: string; expectedOut: string;
//   expectedRemainder: string; expectedOutBytes: Uint8Array; };
// ```
struct Case {
    input: &'static str,
    expected_out: &'static str,
    expected_remainder: &'static str,
    expected_out_bytes: &'static [u8],
}

// What:     `fn run_case(case: &Case)` runs one test case. Takes a
//           shared (read-only) borrow of the `Case`; we only read
//           from it.
// Why:      Factor out the arrange-act-assert boilerplate so each
//           `#[test]` function is one line.
//
// In TS you'd write (pseudocode):
// ```ts
// function runCase(c: Case): void { ... }
// ```
fn run_case(case: &Case) {
    // What:     `let mut out = String::new();`. `String::new()` is
    //           the zero-arg constructor for `String` -- a
    //           heap-allocated growable owned UTF-8 buffer (siblings:
    //           `&str` borrowed slice; `Vec<u8>` raw byte buffer
    //           without UTF-8 invariant). `mut` because
    //           `walk_literal_bytes` will push into it.
    // Why:      Output sink for the walker.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // let out = "";
    // ```
    let mut out = String::new();
    // What:     `let mut remainder = case.input;`. `case.input` is
    //           a `&'static str`; we copy that borrow (cheap, `&str`
    //           is `Copy`) into a new `mut`-able binding so we can
    //           pass `&mut remainder` to the walker. Initial value
    //           is irrelevant -- the walker overwrites it before we
    //           inspect it.
    // Why:      The walker writes the un-walked tail into this
    //           binding via the `&mut &str` out-parameter.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const remainderRef = { value: "" };
    // ```
    let mut remainder = case.input;
    // What:     `walk_literal_bytes(case.input, &mut out, &mut remainder);`.
    //           Three arguments: `case.input` passed by value (cheap
    //           `&str` copy), then `&mut out` and `&mut remainder`
    //           which are mutable BORROWS -- "I am lending you
    //           write access to this binding for the duration of
    //           the call." The walker may modify both.
    // Why:      Exercise the unit under test.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // walkLiteralBytes(case.input, outRef, remainderRef);
    // ```
    walk_literal_bytes(case.input, &mut out, &mut remainder);
    // What:     `assert_eq!(out, case.expected_out, "...")`. Macro
    //           that panics if its first two arguments compare
    //           unequal under `PartialEq`. Optional trailing
    //           arguments are a format-string and values for the
    //           panic message. Rust auto-implements `PartialEq`
    //           between `String` and `&str`.
    // Why:      String-equality check; the format message identifies
    //           which case failed when run as part of the table.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // expect(out).toBe(case.expectedOut);
    // ```
    assert_eq!(
        out, case.expected_out,
        "out mismatch for input {:?}",
        case.input
    );
    // What:     `out.as_bytes()` returns a `&[u8]` view of the
    //           string's underlying bytes WITHOUT copying. The
    //           lifetime of the returned slice is tied to `out`.
    // Why:      Byte-level equality protects against silent
    //           regressions: the bug we just fixed produced 6
    //           mojibake bytes for em-dash; a future regression
    //           that re-introduces it would fail this assertion
    //           even if some `==`-equivalent representation
    //           accidentally compared equal.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // expect([...new TextEncoder().encode(out)]).toEqual(
    //   [...case.expectedOutBytes],
    // );
    // ```
    assert_eq!(
        out.as_bytes(),
        case.expected_out_bytes,
        "byte mismatch for input {:?}",
        case.input
    );
    // What:     Same `assert_eq!` macro; checks the un-walked tail.
    // Why:      Confirms the walker stopped at the expected
    //           position (start of metacharacter, or end of input).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // expect(remainder).toBe(case.expectedRemainder);
    // ```
    assert_eq!(
        remainder, case.expected_remainder,
        "remainder mismatch for input {:?}",
        case.input
    );
}

// What:     `#[test]` attribute marks the function as a unit test;
//           `cargo test` collects every `#[test]` and invokes it.
//           The function name shows up in the test runner output.
// Why:      Per-case `#[test]` functions (rather than one mega-test
//           that loops the whole table) so a failure pinpoints the
//           specific bug-shape that broke. The `Case` struct + `run_case`
//           helper keeps each function to one line.
//
// In TS you'd write (pseudocode):
// ```ts
// test("walks em-dash leading", () => { runCase({ ... }); });
// ```
#[test]
fn walks_em_dash_leading() {
    // What:     `&Case { ... }` constructs a `Case` and immediately
    //           takes a shared reference to it (because `run_case`
    //           takes `&Case`). The reference is valid for the
    //           duration of the function call. `b"\xe2\x80\x94..."`
    //           is a byte-string literal: prefix `b` makes it
    //           `&'static [u8; N]`, with each `\xHH` being one
    //           literal byte (NOT a UTF-8 escape -- we want the
    //           three exact bytes of the em-dash, not any other
    //           interpretation).
    // Why:      Headline regression test: pattern starts with `—`
    //           (U+2014, encoded as 3 UTF-8 bytes `\xe2\x80\x94`).
    //           The pre-fix code would have emitted 6 mojibake
    //           bytes here.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // runCase({ input: "—password", expectedOut: "—password",
    //   expectedRemainder: "", expectedOutBytes: new Uint8Array([
    //     0xe2, 0x80, 0x94, 0x70, 0x61, 0x73, 0x73, 0x77, 0x6f, 0x72, 0x64,
    //   ]) });
    // ```
    run_case(&Case {
        input: "—password",
        expected_out: "—password",
        expected_remainder: "",
        expected_out_bytes: b"\xe2\x80\x94password",
    });
}

#[test]
fn walks_escaped_em_dash() {
    // What:     Same `&Case { ... }` shorthand as the previous test.
    //           The input `"\\—rest"` is a Rust string literal
    //           where `\\` is one literal backslash and `—` is the
    //           em-dash (3 UTF-8 bytes); total source bytes = 5.
    //           `expected_out` is the em-dash followed by `rest`
    //           (no backslash) because the walker's escape branch
    //           treats `\X` as literal `X`.
    // Why:      Regression test for line 90's old `out.push(next as char)`
    //           where `next` was a `u8`: the byte after `\` could
    //           itself be a high byte of a multi-byte sequence,
    //           triggering the same mojibake bug.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // runCase({ input: "\\—rest", expectedOut: "—rest",
    //   expectedRemainder: "",
    //   expectedOutBytes: new Uint8Array([0xe2, 0x80, 0x94, 0x72, 0x65, 0x73, 0x74]) });
    // ```
    run_case(&Case {
        input: "\\—rest",
        expected_out: "—rest",
        expected_remainder: "",
        expected_out_bytes: b"\xe2\x80\x94rest",
    });
}

#[test]
fn walks_pure_ascii_regression() {
    // What:     Plain-ASCII case to confirm the rewrite did not
    //           regress the common path. `b"hello world"` is the
    //           11 ASCII bytes of the literal.
    // Why:      The fix changes the inner loop substantially
    //           (chars iteration instead of byte indexing); a
    //           plain-ASCII regression would be the first thing
    //           we'd want to know about.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // runCase({ input: "hello world", expectedOut: "hello world",
    //   expectedRemainder: "", expectedOutBytes: new Uint8Array(11) /* ascii */ });
    // ```
    run_case(&Case {
        input: "hello world",
        expected_out: "hello world",
        expected_remainder: "",
        expected_out_bytes: b"hello world",
    });
}

#[test]
fn walks_pipe_breaks_at_alternation() {
    // What:     Input `"foo|bar"` -- the walker should consume `foo`
    //           and stop at the `|`, leaving `|bar` as the
    //           remainder.
    // Why:      Confirm the alternation-break behaviour survives
    //           the rewrite. This is critical for soundness:
    //           without it, `extract_required_prefix` would extract
    //           `foo` from `foo|bar` and AC-gate on it, missing
    //           files that contain only `bar`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // runCase({ input: "foo|bar", expectedOut: "foo",
    //   expectedRemainder: "|bar", expectedOutBytes: new Uint8Array([0x66, 0x6f, 0x6f]) });
    // ```
    run_case(&Case {
        input: "foo|bar",
        expected_out: "foo",
        expected_remainder: "|bar",
        expected_out_bytes: b"foo",
    });
}

#[test]
fn walks_metacharacter_breaks() {
    // What:     Input `"foo.*bar"` -- the walker should stop at the
    //           regex metacharacter `.`, leaving `.*bar` as the
    //           remainder.
    // Why:      Confirm metacharacter detection still works after
    //           switching from byte-literals (`b'.'`) to char-literals
    //           (`'.'`).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // runCase({ input: "foo.*bar", expectedOut: "foo",
    //   expectedRemainder: ".*bar", expectedOutBytes: new Uint8Array([0x66, 0x6f, 0x6f]) });
    // ```
    run_case(&Case {
        input: "foo.*bar",
        expected_out: "foo",
        expected_remainder: ".*bar",
        expected_out_bytes: b"foo",
    });
}

#[test]
fn walks_escape_underscore_regression() {
    // What:     Input `"\\_foo"` -- the walker's escape branch
    //           should treat `\_` as literal `_` and produce
    //           `_foo`.
    // Why:      The pre-existing `\_` extraction (referenced in
    //           the function's `Why` comment) is a known important
    //           case for betterleaks-shape rules. Make sure the
    //           rewrite didn't break it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // runCase({ input: "\\_foo", expectedOut: "_foo",
    //   expectedRemainder: "", expectedOutBytes: new Uint8Array([0x5f, 0x66, 0x6f, 0x6f]) });
    // ```
    run_case(&Case {
        input: "\\_foo",
        expected_out: "_foo",
        expected_remainder: "",
        expected_out_bytes: b"_foo",
    });
}

#[test]
fn walks_alphanumeric_escape_breaks() {
    // What:     Input `"foo\\dbar"` -- after `foo` the walker
    //           encounters `\d`, an ASCII alphanumeric escape,
    //           which ends the walk. `out` is `foo`, remainder is
    //           `\dbar`.
    // Why:      Confirm the alphanumeric-escape break still
    //           works (pre-fix it broke on `next.is_ascii_alphanumeric()`
    //           where `next` was `u8`; post-fix it breaks on
    //           `char::is_ascii_alphanumeric`, same behaviour).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // runCase({ input: "foo\\dbar", expectedOut: "foo",
    //   expectedRemainder: "\\dbar", expectedOutBytes: new Uint8Array([0x66, 0x6f, 0x6f]) });
    // ```
    run_case(&Case {
        input: "foo\\dbar",
        expected_out: "foo",
        expected_remainder: "\\dbar",
        expected_out_bytes: b"foo",
    });
}

#[test]
fn walks_em_dash_then_metacharacter() {
    // What:     Input `"—.*"` -- em-dash followed by metacharacter
    //           `.`. The walker should consume the em-dash and
    //           stop at `.`. Remainder is `.*`.
    // Why:      Cross-cutting case: confirms the new char-iteration
    //           correctly advances `tail` past the multi-byte
    //           em-dash before evaluating the next char as a
    //           potential metacharacter. A naive `tail = &tail[1..]`
    //           after `—` would slice mid-character and panic.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // runCase({ input: "—.*", expectedOut: "—",
    //   expectedRemainder: ".*", expectedOutBytes: new Uint8Array([0xe2, 0x80, 0x94]) });
    // ```
    run_case(&Case {
        input: "—.*",
        expected_out: "—",
        expected_remainder: ".*",
        expected_out_bytes: b"\xe2\x80\x94",
    });
}

#[test]
fn walks_two_byte_utf8_leading() {
    // What:     Input starts with `é` (U+00E9), encoded as the
    //           2 UTF-8 bytes `\xc3\xa9`. The walker should
    //           consume it and the rest as literal characters.
    // Why:      Cover the 2-byte UTF-8 path. Previously this was
    //           the EXACT BUG SHAPE: byte `0xc3` cast to `char`
    //           would have produced U+00C3 (`Ã`), and byte `0xa9`
    //           would have produced U+00A9 (`(c)`-symbol). Two
    //           wrong codepoints re-encoding to 4 mojibake bytes
    //           instead of the original 2.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // runCase({ input: "écret", expectedOut: "écret",
    //   expectedRemainder: "",
    //   expectedOutBytes: new Uint8Array([0xc3, 0xa9, 0x63, 0x72, 0x65, 0x74]) });
    // ```
    run_case(&Case {
        input: "écret",
        expected_out: "écret",
        expected_remainder: "",
        expected_out_bytes: b"\xc3\xa9cret",
    });
}

#[test]
fn walks_four_byte_utf8_leading() {
    // What:     Input starts with `🔑` (U+1F511, "key" emoji),
    //           encoded as the 4 UTF-8 bytes `\xf0\x9f\x94\x91`.
    //           The walker should consume the emoji and continue
    //           through any literal characters that follow.
    // Why:      Cover the 4-byte UTF-8 path (the maximum width).
    //           Pre-fix, this would have produced 8 mojibake bytes
    //           (each of the 4 source bytes upcasting to a separate
    //           U+0080..U+00FF codepoint, each re-encoding to 2 UTF-8
    //           bytes). Confirms `next.len_utf8()` advance handles
    //           4 correctly.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // runCase({ input: "🔑secret", expectedOut: "🔑secret",
    //   expectedRemainder: "",
    //   expectedOutBytes: new Uint8Array([0xf0, 0x9f, 0x94, 0x91, 0x73, 0x65, 0x63, 0x72, 0x65, 0x74]) });
    // ```
    run_case(&Case {
        input: "🔑secret",
        expected_out: "🔑secret",
        expected_remainder: "",
        expected_out_bytes: b"\xf0\x9f\x94\x91secret",
    });
}

#[test]
fn walks_escaped_emoji() {
    // What:     Input `"\\🔑rest"` -- backslash followed by the
    //           4-byte emoji `🔑` followed by `rest`. The escape
    //           branch should treat `\🔑` as literal `🔑` and
    //           continue through `rest`.
    // Why:      Stress-tests the `next.len_utf8()` advance on the
    //           escape branch (`tail = &after_bs[next.len_utf8()..]`).
    //           Hard-coding `2` (one byte for `\`, one byte for
    //           `next`) would underadvance by 3 bytes here and the
    //           next iteration's `chars.next()` would panic on a
    //           non-char-boundary slice.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // runCase({ input: "\\🔑rest", expectedOut: "🔑rest",
    //   expectedRemainder: "",
    //   expectedOutBytes: new Uint8Array([0xf0, 0x9f, 0x94, 0x91, 0x72, 0x65, 0x73, 0x74]) });
    // ```
    run_case(&Case {
        input: "\\🔑rest",
        expected_out: "🔑rest",
        expected_remainder: "",
        expected_out_bytes: b"\xf0\x9f\x94\x91rest",
    });
}

#[test]
fn walks_empty_input() {
    // What:     Empty input `""`. Loop guard `!tail.is_empty()`
    //           is immediately false, so the loop body never
    //           runs; remainder is set to `tail` (also empty).
    // Why:      Edge case: callers may pass empty `&str` after
    //           consuming an entire prior atom. Walker must not
    //           panic and must leave `out` and `remainder` empty.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // runCase({ input: "", expectedOut: "",
    //   expectedRemainder: "", expectedOutBytes: new Uint8Array([]) });
    // ```
    run_case(&Case {
        input: "",
        expected_out: "",
        expected_remainder: "",
        expected_out_bytes: b"",
    });
}

#[test]
fn walks_trailing_backslash() {
    // What:     Input `"\\"` -- a lone backslash with nothing
    //           after it. The escape branch's let-else
    //           `let Some(next) = ... else { break; };` triggers
    //           the break, and the remainder ends up pointing at
    //           `\`.
    // Why:      Corresponds to the original byte-walker's
    //           `if i + 1 >= bytes.len() { break; }` check.
    //           Without this branch the let-else would silently
    //           consume the `\` and produce wrong output.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // runCase({ input: "\\", expectedOut: "",
    //   expectedRemainder: "\\", expectedOutBytes: new Uint8Array([]) });
    // ```
    run_case(&Case {
        input: "\\",
        expected_out: "",
        expected_remainder: "\\",
        expected_out_bytes: b"",
    });
}

#[test]
fn walks_mixed_widths_consecutive() {
    // What:     Input `"a—é🔑z"` mixes 1-byte ASCII, 3-byte BMP,
    //           2-byte Latin-1-supplement, 4-byte SMP, and ASCII
    //           again. All five chars are literals; walker should
    //           consume the whole input and produce identical
    //           bytes.
    // Why:      Stress-test the char-by-char advance: `tail =
    //           chars.as_str()` after each push must land on the
    //           correct char boundary regardless of the previous
    //           char's width. A regression where the byte-offset
    //           accounting drifts after one width would produce
    //           panics or mojibake on the next char.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // runCase({ input: "a—é🔑z", expectedOut: "a—é🔑z",
    //   expectedRemainder: "",
    //   expectedOutBytes: new Uint8Array([
    //     0x61, 0xe2, 0x80, 0x94, 0xc3, 0xa9, 0xf0, 0x9f, 0x94, 0x91, 0x7a,
    //   ]) });
    // ```
    run_case(&Case {
        input: "a—é🔑z",
        expected_out: "a—é🔑z",
        expected_remainder: "",
        expected_out_bytes: b"a\xe2\x80\x94\xc3\xa9\xf0\x9f\x94\x91z",
    });
}
