// What:     `fuzz_literal_roundtrip` checks the literal-escape
//           -> walk round-trip: take an arbitrary byte slice,
//           escape every regex metacharacter, feed the result to
//           `walk_literal_bytes`, and assert the walker recovers
//           the original bytes (or stops at a non-literal it
//           reasonably might).
// Why:      Cheap shape-test: complements `fuzz_regex_syntax_walkers`
//           with a semantic check. The walker has to UN-escape
//           `\X` punctuation correctly; a regression there
//           (treating `\.` as the metachar `.` again) would let
//           literal bytes leak out of the recovered output.

#![no_main]

use libfuzzer_sys::fuzz_target;

use forbidden_strings::fuzz_api::*;

// What:     `fn escape_literal(s: &str) -> String`. Conservative
//           escaper: every metacharacter in `walk_literal_bytes`'s
//           sentinel set gets a leading `\`. Non-printable / non-
//           ASCII bytes pass through unchanged (they're not
//           metacharacters).
// Why:      We control the input; the escaper does what a manual
//           translator would do. The walker is the system under
//           test. The escape set MUST stay in sync with
//           `walk_literal_bytes`'s break set, or the round-trip is
//           a false failure: `_` is a resharp wildcard that the
//           walker stops on (the "BUG 10" fix in atom.rs), so a
//           bare `_` must be escaped to `\_` here, otherwise the
//           walker recovers nothing for input like `_foo`.
fn escape_literal(s: &str) -> String {
    let mut out = String::with_capacity(s.len() * 2);
    for c in s.chars() {
        match c {
            '.' | '*' | '+' | '?' | '|' | '(' | ')' | '[' | ']' | '{' | '}'
            | '^' | '$' | '\\' | '&' | '~' | '_' => {
                out.push('\\');
                out.push(c);
            }
            _ => out.push(c),
        }
    }
    out
}

fuzz_target!(|s: String| {
    // What:     Filter the input: only ASCII letters/digits/spaces
    //           (and a few innocuous punctuation chars) so the
    //           walker has clean input to roundtrip against.
    //           `walk_literal_bytes` stops at non-literal-class
    //           characters and at non-ASCII alphabetic escape
    //           sequences. Hand it ascii-only input.
    // Why:      Keep the test focused on the escape-and-recover
    //           shape rather than fighting with class-bytes.
    let filtered: String = s
        .chars()
        .filter(|c| {
            c.is_ascii_alphanumeric()
                || *c == ' '
                || *c == '-'
                || *c == '_'
                || *c == ':'
                || *c == '@'
                || *c == '#'
                || *c == '.'
                || *c == '!'
                || *c == '\\'
                || *c == '/'
        })
        .take(256)
        .collect();
    if filtered.is_empty() {
        return;
    }

    // What:     `let escaped = escape_literal(&filtered);`. Produce
    //           the regex source whose meaning is "match these
    //           bytes literally".
    let escaped = escape_literal(&filtered);

    // What:     `let mut out = String::new();` and a remainder
    //           binding -- walker's three-argument signature.
    let mut out = String::new();
    let mut remainder: &str = &escaped;
    walk_literal_bytes(&escaped, &mut out, &mut remainder);

    //region Invariant: walker output equals the original filtered input

    // The walker should consume the entire escaped string and
    // produce the original filtered bytes in `out`.
    assert!(
        remainder.is_empty(),
        "walker did not consume entire escaped input.\n\
         escaped = {:?}\n\
         remainder = {:?}\n\
         out = {:?}",
        escaped,
        remainder,
        out,
    );
    assert_eq!(
        out, filtered,
        "walker did not recover the original literal.\n\
         filtered = {:?}\n\
         escaped = {:?}\n\
         out = {:?}",
        filtered, escaped, out,
    );

    //endregion
});
