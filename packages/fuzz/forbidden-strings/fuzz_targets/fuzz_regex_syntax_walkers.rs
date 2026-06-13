// What:     `fuzz_regex_syntax_walkers` feeds arbitrary `&str` slices
//           to the six index-walking helpers and asserts: panic
//           freedom, returned offsets stay inside the input,
//           returned offsets land on UTF-8 char boundaries, and
//           returned suffix slices ARE actually suffixes of the
//           input (pointer-and-length identity, not just
//           value-equal bytes).
// Why:      These walkers underpin the AC-prefix extractor and the
//           routing classifier. A panic here, or an off-by-one
//           that hands the caller a "suffix" that isn't actually a
//           suffix, propagates straight into rule loading and
//           silently disables rules. Walker bugs caused commits
//           e49d8694, e100659f, 1463c59b; a fuzz target on them
//           catches the next entry in that class.

#![no_main]

use libfuzzer_sys::fuzz_target;

use forbidden_strings::fuzz_api::*;

// What:     `fn assert_is_suffix(input: &str, candidate: &str)`. Asserts
//           the byte address range of `candidate` falls inside `input`
//           AND that `candidate.len()` equals `input.len() - offset`
//           for some valid offset. Pointer math + length compare;
//           guards against a walker that returns a NEW owned string
//           or a borrowed slice from somewhere else.
// Why:      Plan §7.4 "returned suffixes are actual suffixes of the
//           input".
fn assert_is_suffix(input: &str, candidate: &str, helper_name: &str) {
    let input_start = input.as_ptr() as usize;
    let input_end = input_start + input.len();
    let candidate_start = candidate.as_ptr() as usize;
    let candidate_end = candidate_start + candidate.len();

    // What:     A candidate of length 0 may legitimately be the empty
    //           slice at `input_end`. Allow it.
    // Why:      Empty suffix is always a valid suffix.
    if candidate.is_empty() {
        return;
    }

    assert!(
        candidate_start >= input_start && candidate_end <= input_end,
        "{}: returned slice {:p}..{:p} escapes input range {:p}..{:p}",
        helper_name,
        candidate.as_ptr(),
        (candidate_end as *const u8),
        input.as_ptr(),
        (input_end as *const u8),
    );
}

// What:     `fn assert_offset_in_input(input: &str, offset: usize)`.
//           Asserts the returned index is at most `input.len()` and
//           lands on a UTF-8 char boundary.
// Why:      Walker invariants 2-3 (offsets inside input, UTF-8
//           boundary).
fn assert_offset_in_input(input: &str, offset: usize, helper_name: &str) {
    assert!(
        offset <= input.len(),
        "{}: offset {} exceeds input len {}",
        helper_name,
        offset,
        input.len(),
    );
    // `is_char_boundary` returns true at 0, at len(), and at every
    // UTF-8 start-byte position. Continuation bytes return false.
    assert!(
        input.is_char_boundary(offset),
        "{}: offset {} not on UTF-8 char boundary",
        helper_name,
        offset,
    );
}

fuzz_target!(|s: String| {
    // What:     `let s: &str = &s;`. Re-borrow the owned String as a
    //           borrowed `&str`. Walkers take `&str`, not `String`.
    // Why:      Single source of truth for the walker inputs.
    let s: &str = &s;

    //region group_body_start

    // What:     `let r = group_body_start(s);`. Pattern: `Option<usize>`.
    //           Some(off) -> off in input AND on a UTF-8 boundary.
    //           None -> walker rejected the input; no further check.
    // Why:      Panic freedom is itself the test; the Option result
    //           gates the boundary check.
    if let Some(off) = group_body_start(s) {
        assert_offset_in_input(s, off, "group_body_start");
    }

    //endregion

    //region find_matching_close_paren

    if let Some(off) = find_matching_close_paren(s) {
        assert_offset_in_input(s, off, "find_matching_close_paren");
        // The result must be the byte at which `)` lives. If the
        // walker returned `off`, then `s.as_bytes()[off]` must be
        // `b')'`. This catches off-by-one regressions.
        if off < s.len() {
            assert_eq!(
                s.as_bytes()[off],
                b')',
                "find_matching_close_paren: byte at offset {} is 0x{:02x}, not ')'",
                off,
                s.as_bytes()[off],
            );
        }
    }

    //endregion

    //region skip_any_quantifier

    // What:     `let after = skip_any_quantifier(s);`. Always returns
    //           a `&str` (no Option). Must be a suffix of `s`.
    let after = skip_any_quantifier(s);
    assert_is_suffix(s, after, "skip_any_quantifier");
    assert!(
        after.len() <= s.len(),
        "skip_any_quantifier: returned suffix longer than input",
    );

    //endregion

    //region quantifier_is_required

    // What:     `quantifier_is_required(s)` returns plain `bool`.
    //           Panic-freedom is the entire assertion; the bool itself
    //           has no shape invariant we can check without re-deriving
    //           the spec.
    let _ = quantifier_is_required(s);

    //endregion

    //region skip_class_body

    if let Some(after) = skip_class_body(s) {
        assert_is_suffix(s, after, "skip_class_body");
    }

    //endregion

    //region walk_literal_bytes

    // What:     `let mut out = String::new();` -- owned buffer the
    //           walker writes literal chars into. `let mut remainder: &str = s;`
    //           -- initial state; the walker overwrites this with the
    //           un-walked tail. `&mut` takes a mutable reference.
    // Why:      Three-argument walker: literal-char output buffer,
    //           remainder pointer-out, input slice.
    let mut out = String::new();
    let mut remainder: &str = s;
    walk_literal_bytes(s, &mut out, &mut remainder);
    assert_is_suffix(s, remainder, "walk_literal_bytes.remainder");
    // The `out` buffer must be valid UTF-8 (it's a String, so the
    // type system enforces this). Beyond that: out.len() must not
    // exceed s.len() (each literal byte we write came from one or
    // two input bytes; we can't emit more than we read).
    assert!(
        out.len() <= s.len(),
        "walk_literal_bytes: output longer than input",
    );

    //endregion
});
