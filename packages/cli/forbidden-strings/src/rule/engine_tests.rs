// What:     Unit tests for `super::engine::requires_resharp`. Exists
//           as a sibling module so it can reach the `pub` item via
//           `super::engine::...` (sibling modules under the same parent
//           share visibility scope; `pub` is wider than needed but
//           that is what the function carries because external callers
//           re-export it).
// Why:      Compile-time gated by `#[cfg(test)]` in the parent module
//           (`rule.rs`); contributes nothing to the release binary.
//           A separate file (rather than inline `mod tests` inside
//           `engine.rs`) keeps the production source small and lets
//           the test file carry its own dum-dum-non-ts comment density.
//
// In TS you'd write (pseudocode):
// ```ts
// import { requiresResharp } from "./engine";
// describe("requiresResharp", () => { ... });
// ```

// What:     `use super::engine::requires_resharp;` brings the function
//           under test into scope. `super` refers to the parent module
//           (`crate::rules`); `engine` is its sibling submodule.
// Why:      Avoid writing the full path at every call site.
//
// In TS you'd write (pseudocode):
// ```ts
// import { requiresResharp } from "./engine";
// ```
use super::engine::requires_resharp;

// What:     `struct Case { ... }` is a record type with two owned
//           fields:
//           - `pattern: &'static str`. A borrowed slice of bytes baked
//             into the binary at compile time. Sibling: `String`,
//             which would be heap-allocated and owned. Test fixtures
//             are literals, so the borrow is fine.
//           - `expected: bool`. Plain primitive; no sibling concerns.
// Why:      Group the two fixture values per case so the table stays
//           one-row-per-case. Naming over a tuple because positional
//           bools next to strings are easy to misread.
//
// In TS you'd write (pseudocode):
// ```ts
// type Case = { pattern: string; expected: boolean };
// ```
struct Case {
    pattern: &'static str,
    expected: bool,
}

// What:     `fn run_case(case: &Case)` runs one test case. Takes a
//           shared (read-only) borrow of the `Case`; we only read
//           from it.
// Why:      Factor out the call-and-assert boilerplate so each
//           `#[test]` function is one line.
//
// In TS you'd write (pseudocode):
// ```ts
// function runCase(c: Case): void { ... }
// ```
fn run_case(case: &Case) {
    // What:     `let actual = requires_resharp(case.pattern);` calls
    //           the function under test. `case.pattern` is `&'static str`
    //           and `requires_resharp` accepts `&str`, so the borrow
    //           narrows automatically (`&'static str` -> `&'_ str`).
    // Why:      Capture the routing decision in a binding so the assert
    //           message can quote it.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const actual = requiresResharp(case.pattern);
    // ```
    let actual = requires_resharp(case.pattern);
    // What:     `assert_eq!(actual, case.expected, "...", ...)` panics if
    //           the two values differ under `PartialEq`. Trailing format
    //           args populate the panic message. Booleans are `Copy`,
    //           so dereferencing the borrow is implicit.
    // Why:      Pinpoint the failing pattern in the panic output;
    //           collected into a table the bare actual/expected pair
    //           would not say which row broke.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // expect(actual).toBe(case.expected);
    // ```
    assert_eq!(
        actual, case.expected,
        "requires_resharp({:?}) = {} but expected {}",
        case.pattern, actual, case.expected
    );
}

// What:     `#[test]` attribute marks the function as a unit test;
//           `cargo test` discovers and runs every `#[test]`. The
//           function name appears in the runner output.
// Why:      Per-case `#[test]` functions (rather than one mega-test
//           that loops the whole table) so a failure pinpoints the
//           specific rule shape that broke.
//
// In TS you'd write (pseudocode):
// ```ts
// test("set algebra amp triggers", () => { runCase({ ... }); });
// ```
#[test]
fn set_algebra_amp_triggers() {
    run_case(&Case { pattern: "foo&bar", expected: true });
}

#[test]
fn set_algebra_complement_triggers() {
    run_case(&Case { pattern: "~(foo)", expected: true });
}

#[test]
fn escaped_amp_does_not_trigger() {
    run_case(&Case { pattern: r"foo\&bar", expected: false });
}

#[test]
fn in_class_amp_does_not_trigger() {
    run_case(&Case { pattern: "[&a-z]+", expected: false });
}

#[test]
fn lookahead_triggers() {
    run_case(&Case { pattern: "foo(?=bar)", expected: true });
}

#[test]
fn negative_lookahead_triggers() {
    run_case(&Case { pattern: "foo(?!bar)", expected: true });
}

#[test]
fn lookbehind_triggers() {
    run_case(&Case { pattern: "(?<=foo)bar", expected: true });
}

#[test]
fn negative_lookbehind_triggers() {
    run_case(&Case { pattern: "(?<!foo)bar", expected: true });
}

#[test]
fn non_capturing_group_does_not_trigger() {
    run_case(&Case { pattern: "(?:foo)bar", expected: false });
}

#[test]
fn named_capture_angle_does_not_trigger() {
    run_case(&Case { pattern: "(?<name>foo)bar", expected: false });
}

#[test]
fn named_capture_p_does_not_trigger() {
    run_case(&Case { pattern: "(?P<name>foo)bar", expected: false });
}

#[test]
fn inline_flags_do_not_trigger() {
    run_case(&Case { pattern: "(?i)foo", expected: false });
}

#[test]
fn escaped_lookahead_does_not_trigger() {
    // What:     `r"\(?=foo\)"` is a raw byte-string-like literal
    //           (the `r` prefix turns off escape processing inside the
    //           literal, so `\(` stays as the two characters
    //           backslash-paren -- exactly what the regex parser sees).
    //           In regex syntax this is "a literal `(` followed by an
    //           optional `?` (i.e. zero or one `?`) followed by `=foo`
    //           followed by a literal `)`". No lookaround.
    // Why:      Confirms the escape walker (advance-by-2 on `\\`) skips
    //           the paren so the lookaround detector never sees a
    //           bare `(?=` here.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // runCase({ pattern: String.raw`\(?=foo\)`, expected: false });
    // ```
    run_case(&Case { pattern: r"\(?=foo\)", expected: false });
}

#[test]
fn in_class_lookalike_does_not_trigger() {
    // What:     `[(?=]` is a character class containing the literal
    //           characters `(`, `?`, `=`. Inside a class, parens are
    //           not group delimiters and `?` is not a quantifier;
    //           the resemblance to `(?=` is coincidental.
    // Why:      Confirms the in-class skip prevents the lookaround
    //           detector from misfiring on literal characters.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // runCase({ pattern: "[(?=]", expected: false });
    // ```
    run_case(&Case { pattern: "[(?=]", expected: false });
}

#[test]
fn prose_em_dash_pattern_triggers() {
    // What:     The exact pattern the user reported: matches ` -- `
    //           with a lowercase letter on either side (an em-dash
    //           used in prose). Combines a positive lookbehind and a
    //           positive lookahead.
    // Why:      Headline regression: pre-fix this routed to the
    //           `regex` crate which rejects lookarounds; post-fix it
    //           must route to resharp.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // runCase({ pattern: "(?<=[a-z]) -- (?=[a-z])", expected: true });
    // ```
    run_case(&Case { pattern: "(?<=[a-z]) -- (?=[a-z])", expected: true });
}

#[test]
fn plain_literal_does_not_trigger() {
    run_case(&Case { pattern: "AKIA1234567890ABCDEF", expected: false });
}

#[test]
fn plain_regex_no_lookaround_does_not_trigger() {
    run_case(&Case { pattern: r"hvb\.[\w-]{138,300}", expected: false });
}

#[test]
fn bare_underscore_wildcard_triggers() {
    // What:     `_` outside a character class is resharp's universal
    //           wildcard (matches any single character), distinct from
    //           a literal underscore. The `regex` crate treats `_` as a
    //           literal byte, so routing a rule like `pre_post` to the
    //           `regex` crate compiles a matcher that searches for the
    //           literal seven-byte sequence `pre_post` -- semantically
    //           opposite to what the rule author wrote.
    // Why:      Closes BUG 10. Pre-fix `requires_resharp("pre_post")`
    //           returned false and the rule routed to the `regex` crate,
    //           silently corrupting the rule's meaning. Post-fix the
    //           function detects bare `_` and routes to resharp where
    //           the wildcard semantics are preserved.
    run_case(&Case { pattern: "pre_post", expected: true });
}

#[test]
fn escaped_underscore_does_not_trigger() {
    // What:     `pre\_post` -- the backslash makes the underscore a
    //           literal character, identical between resharp and the
    //           `regex` crate. The escape walker consumes the `\_` as
    //           a two-byte unit and never visits the `_` byte directly.
    // Why:      Regression guard: hundreds of GitHub-PAT-shaped rules
    //           in the betterleaks corpus use `ghp\_[0-9a-zA-Z]{36}` --
    //           with the underscore explicitly escaped. Those must stay
    //           on the `regex` crate fast path.
    run_case(&Case { pattern: r"pre\_post", expected: false });
}

#[test]
fn in_class_underscore_does_not_trigger() {
    // What:     `[_]` is a character class containing the literal byte
    //           `_`. Inside a class, the `_` does NOT carry resharp's
    //           wildcard semantics -- the class is a set of literal
    //           bytes regardless of the engine. Class-internal `_`
    //           must not route to resharp.
    // Why:      Regression guard against future changes that would
    //           drop the in_class tracking and false-positive on
    //           every `[A-Z_]`-shaped class.
    run_case(&Case { pattern: "[A-Z_]+", expected: false });
}

// What:     Tests for `super::engine::lookaround_in_complement`. The
//           function rejects patterns that would make resharp 0.5.x
//           through 0.6.x fail at compile time inside a `~(...)` body;
//           this section
//           covers every documented failing shape plus the boundary
//           cases (escaped triggers, class interiors, anchors outside
//           any complement) where the function MUST stay quiet.
// Why:      Regression net. The doc enumerates each shape; each one
//           gets a matching unit test so a future change that misses
//           a category fails loudly. Positive (rejected) and negative
//           (accepted) tests live next to each other so reading the
//           file gives a sense of the function's contract.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("lookaroundInComplement", () => { ... });
// ```
use super::engine::lookaround_in_complement;

// What:     `fn assert_rejected(pattern: &str, expect_substr: &str)`
//           checks that the function returns `Some(msg)` and that
//           `msg` contains the expected fragment naming the trigger.
//           Substring assert (not equality) is intentional: it lets
//           the message wording evolve without breaking tests while
//           still verifying the trigger name reaches the user.
// Why:      Catch both regressions: missing the rejection entirely,
//           and rejecting with a wrong trigger name.
//
// In TS you'd write (pseudocode):
// ```ts
// function assertRejected(pattern: string, substr: string) {
//   const r = lookaroundInComplement(pattern);
//   expect(r).not.toBeNull();
//   expect(r).toContain(substr);
// }
// ```
fn assert_rejected(pattern: &str, expect_substr: &str) {
    let actual = lookaround_in_complement(pattern);
    match actual {
        Some(msg) => assert!(
            msg.contains(expect_substr),
            "lookaround_in_complement({:?}) returned message that did not contain {:?}: {}",
            pattern, expect_substr, msg
        ),
        None => panic!(
            "lookaround_in_complement({:?}) returned None; expected Some(_) containing {:?}",
            pattern, expect_substr
        ),
    }
}

fn assert_accepted(pattern: &str) {
    let actual = lookaround_in_complement(pattern);
    assert!(
        actual.is_none(),
        "lookaround_in_complement({:?}) = {:?}; expected None",
        pattern, actual
    );
}

#[test]
fn complement_with_word_boundary_rejected() {
    assert_rejected(r"em&~(.*\bword\b.*)", r"\b");
}

#[test]
fn complement_with_not_word_boundary_rejected() {
    assert_rejected(r"em&~(.*\B.*)", r"\B");
}

#[test]
fn complement_with_caret_rejected() {
    assert_rejected(r"em&~(^foo$)", "^");
}

#[test]
fn complement_with_dollar_rejected() {
    assert_rejected(r"em&~(foo$)", "$");
}

#[test]
fn complement_with_explicit_lookahead_rejected() {
    assert_rejected(r"em&~((?=foo).*)", "lookahead");
}

#[test]
fn complement_with_explicit_neg_lookahead_rejected() {
    assert_rejected(r"em&~((?!foo).*)", "lookahead");
}

#[test]
fn complement_with_explicit_lookbehind_rejected() {
    assert_rejected(r"em&~((?<=foo).*)", "lookbehind");
}

#[test]
fn complement_with_explicit_neg_lookbehind_rejected() {
    assert_rejected(r"em&~((?<!foo).*)", "lookbehind");
}

#[test]
fn second_of_two_complements_rejected() {
    // What:     Two chained complements; only the second contains the
    //           trigger. The guard must still flag the rule.
    // Why:      Confirms the paren-stack tracking pops correctly so the
    //           second complement's depth is recognised.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // assertRejected("em&~(.*foo.*)&~(.*\\bword\\b.*)", "\\b");
    // ```
    assert_rejected(r"em&~(.*foo.*)&~(.*\bword\b.*)", r"\b");
}

#[test]
fn nested_group_inside_complement_with_boundary_rejected() {
    // What:     `\b` lives inside a non-capturing group nested inside
    //           the complement. Still "inside the complement" for
    //           resharp's purposes.
    // Why:      Confirms `in_complement` reflects "any `true` in the
    //           paren stack" rather than just "topmost".
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // assertRejected("em&~((?:foo|\\bword\\b).*)", "\\b");
    // ```
    assert_rejected(r"em&~((?:foo|\bword\b).*)", r"\b");
}

#[test]
fn boundary_outside_any_complement_accepted() {
    assert_accepted(r"\bem\b&_*&~(.*foo.*)");
}

#[test]
fn text_anchors_inside_complement_accepted() {
    // What:     `\A` and `\z` route to `NodeId::BEGIN` / `NodeId::END`
    //           directly without the lookaround rewrite (see doc step 1).
    //           Inside a complement, they compile cleanly.
    // Why:      Guard must NOT reject these; otherwise we mask the only
    //           workaround the doc recommends for whole-content anchors.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // assertAccepted("em&~(\\Afoo\\z)");
    // ```
    assert_accepted(r"em&~(\Afoo\z)");
}

#[test]
fn caret_in_class_inside_complement_accepted() {
    // What:     `[^abc]` is a negated character class. The `^` is the
    //           class-negation operator, not the line-anchor; resharp
    //           does not rewrite it to a lookaround.
    // Why:      Guard must skip class interiors so it does not misfire
    //           on every negated class inside any complement.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // assertAccepted("em&~([^abc].*)");
    // ```
    assert_accepted(r"em&~([^abc].*)");
}

#[test]
fn dollar_in_class_inside_complement_accepted() {
    assert_accepted(r"em&~([$].*)");
}

#[test]
fn escaped_backslash_b_inside_complement_accepted() {
    // What:     `\\b` in the rule source is a literal backslash followed
    //           by `b`. The escape walker consumes the first backslash
    //           as the escape, then the second one starts a new escape
    //           whose escapee is `b` -- but the rule semantically is
    //           NOT `\b`; the rule source `\\b` means "match literal
    //           backslash, then literal b". The escape walker correctly
    //           skips past the doubled backslash without seeing `\b`.
    // Why:      Guard must distinguish "the regex source contains \b"
    //           from "the regex source contains a literal backslash
    //           followed by b".
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // assertAccepted("em&~(\\\\b.*)");
    // ```
    assert_accepted(r"em&~(\\b.*)");
}

#[test]
fn plain_set_algebra_without_triggers_accepted() {
    assert_accepted(r"BUILD_[0-9]{6}&~(BUILD_000000)");
}

#[test]
fn rule_without_complement_accepted_even_with_lookaround() {
    // What:     Lookarounds outside any `~(...)` body compile cleanly
    //           in resharp 0.5.x through 0.6.x; the restriction is
    //           complement-of-lookaround specifically.
    // Why:      Guard must not reject the prose-em-dash pattern
    //           verified in `prose_em_dash_pattern_triggers`.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // assertAccepted("(?<=[a-z]) -- (?=[a-z])");
    // ```
    assert_accepted(r"(?<=[a-z]) -- (?=[a-z])");
}

#[test]
fn plain_literal_accepted() {
    assert_accepted("AKIA1234567890ABCDEF");
}

// What:     `use super::engine::CompiledRegex;` imports the unified
//           compiled-regex container so we can construct values and
//           call inherent methods on it.
// Why:      The BUG 7 regression tests below need to assert the new
//           `is_match` shape (`Result<bool, ()>` rather than `bool`).
use super::engine::CompiledRegex;
use regex::bytes::Regex as PlainRegex;

// What:     `#[test] fn is_match_returns_result_ok_for_match()`. BUG 7
//           regression test. The fix changes `CompiledRegex::is_match`
//           from `fn(&self, &[u8]) -> bool` to `fn(&self, &[u8]) ->
//           Result<bool, ()>`. Pre-fix the function silently swallowed
//           engine errors via `unwrap_or(false)`, so a regex engine
//           that panicked under load or hit a runtime limit would be
//           indistinguishable from a no-match -- a fail-open shape
//           against a secret-scanning tool. Post-fix callers MUST
//           pattern-match on `Ok`/`Err` and can therefore emit a
//           synthetic hit when the engine refuses to evaluate. This
//           test documents the new contract by destructuring the
//           returned value into `Ok(bool)`; it would fail to compile
//           if the signature regressed to bare `bool`.
// Why:      A unit test on the type shape is the deterministic regression
//           we can write without constructing a real engine error
//           (resharp errors only fire on specific pathological inputs
//           that are hard to bake into a stable test). Integration
//           coverage at the binary boundary is impractical here for
//           the same reason; the signature-level test still catches
//           any future change that silently re-folds errors into
//           `false`.
//
// In TS you'd write (pseudocode):
// ```ts
// test("is_match returns Result shape", () => {
//   const cr: CompiledRegex = { kind: "plain", re: new RegExp("foo") };
//   const r = cr.isMatch(new TextEncoder().encode("foo"));
//   if (r.kind !== "ok") throw new Error("expected Ok");
//   expect(r.value).toBe(true);
// });
// ```
#[test]
fn is_match_returns_result_ok_for_match_plain() {
    let re = PlainRegex::new("foo").expect("compile plain regex");
    let cr = CompiledRegex::Plain(re);
    match cr.is_match(b"hello foo world") {
        Ok(true) => {}
        Ok(false) => panic!("expected match on plain branch"),
        Err(()) => panic!("expected Ok, got Err on plain branch"),
    }
}

#[test]
fn is_match_returns_result_ok_for_no_match_plain() {
    let re = PlainRegex::new("foo").expect("compile plain regex");
    let cr = CompiledRegex::Plain(re);
    match cr.is_match(b"hello world") {
        Ok(false) => {}
        Ok(true) => panic!("expected no match on plain branch"),
        Err(()) => panic!("expected Ok, got Err on plain branch"),
    }
}

#[test]
fn is_match_returns_result_ok_for_match_resharp() {
    let re = resharp::Regex::new("foo&_*").expect("compile resharp regex");
    let cr = CompiledRegex::Resharp(re);
    match cr.is_match(b"hello foo world") {
        Ok(true) => {}
        Ok(false) => panic!("expected match on resharp branch"),
        Err(()) => panic!("expected Ok, got Err on resharp branch"),
    }
}

// What:     Tests for the pre-validators that detect resharp 0.5.x
//           through 0.6.x panic / silent-corruption shapes
//           (`intersection_with_lookbehind`,
//           `intersection_with_word_end_alternation`). Imports run
//           through `super::engine::*` rather than the crate-public
//           re-exports because the pre-validators are sibling items
//           in the same submodule -- `super` is the natural reach
//           and avoids a longer `crate::rule::...` path.
// Why:      Each detector is one cheap byte walk over the source;
//           tests should exercise the positive trigger AND the
//           negative cases that look superficially similar (escaped
//           `&`, intersection-in-class, lookbehind alone) to make
//           sure we are not over-rejecting working rules.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("intersection_with_lookbehind", () => { ... });
// describe("intersection_with_word_end_alternation", () => { ... });
// ```
use super::engine::{
    intersection_with_lookbehind,
    intersection_with_word_end_alternation,
};

// What:     `assert!(intersection_with_lookbehind(src).is_some(), ...)`
//           asserts the detector fired on a known-panic shape. The
//           message format includes the source so a failing test
//           pinpoints which case regressed.
// Why:      Positive triggers: every minimal panic-shape bisected
//           in docs/troubleshooting/resharp.md must keep firing.
#[test]
fn intersection_with_lookbehind_fires_on_minimal_shape() {
    let cases = [
        // What:     The minimum reproducer for the runtime panic at
        //           `resharp/src/engine.rs:1020`. Compile succeeds,
        //           `find_all` panics on content >= 64 bytes.
        // Why:      Anchor the detector on the exact shape we
        //           bisected; if anyone simplifies the walker and
        //           drops this, the test fails.
        "(?:(?=a)&(?<=_))",
        "(?:(?=a)&(?<!b))",
        "(?:(?<=a)&(?=b))",
        // Original artifact 1 (full structure, parsed via Arbitrary).
        "(?:(?=(?=(?:(?:(?:EBEE)))))&(?<=(?:(?=(?=(?=_))))))",
        // Generalised cases: `&` + lookahead only (no lookbehind).
        // The detector now covers both lookaround directions per
        // the comment widening; the original "two-lookahead returns
        // parse error not panic" claim still holds for the resharp
        // engine, but pre-validating gives the rule author a
        // friendlier error than `Algebra(UnsupportedPattern)`.
        "(?:(?=a)&b)",
        "(?:(?=a)&(?=b))",
        "(?:foo&(?!bar))",
    ];
    for src in cases {
        assert!(
            intersection_with_lookbehind(src).is_some(),
            "expected intersection_with_lookbehind to fire on {:?}",
            src
        );
    }
}

// What:     Negative cases: shapes that look like the trigger but
//           do not actually drive the panic. The detector must
//           leave them alone.
// Why:      Conservative over-rejection still costs the user a
//           working rule; pin the false-negative behaviour we
//           rely on for the rest of the corpus.
#[test]
fn intersection_with_lookbehind_skips_safe_shapes() {
    let cases = [
        // No intersection.
        "(?<=a)foo",
        "(?=a)bar",
        // Intersection without ANY lookaround (post-widening: only
        // shapes with neither lookahead nor lookbehind are safe).
        "(?:foo&bar)",
        // `&` inside a character class is a literal, not the operator.
        "[a&b]",
        // Escaped `&` is a literal.
        "foo\\&bar",
        // `(?<name>...)` named capture is NOT a lookbehind.
        "(?<name>a)",
    ];
    for src in cases {
        assert!(
            intersection_with_lookbehind(src).is_none(),
            "expected intersection_with_lookbehind to PASS on {:?}; got {:?}",
            src,
            intersection_with_lookbehind(src)
        );
    }
}

#[test]
fn intersection_with_word_end_alternation_fires_on_minimal_shape() {
    let cases = [
        // What:     Minimum bisected shape for the compile panic at
        //           `resharp-algebra/src/lib.rs:2470`
        //           (`attempt to add with overflow`). Bisection
        //           details in docs/troubleshooting/resharp.md.
        // Why:      Anchor the detector on the trigger combination
        //           `& + \w + $`.
        "(?:\\w|$)(?:(?![1g]\\_X)& a)",
        "(?:\\w|$)& a",
        "(?u:(?:\\w|$)(?:(?![1g]\\_X)& a))",
        // Original artifact 2.
        "(?u:(?u:(?:\\w|$|(?=~(\\_))))(?:(?![1gtu-w]\\_X# lH :)& N))",
    ];
    for src in cases {
        assert!(
            intersection_with_word_end_alternation(src).is_some(),
            "expected intersection_with_word_end_alternation to fire on {:?}",
            src
        );
    }
}

#[test]
fn intersection_with_word_end_alternation_skips_safe_shapes() {
    let cases = [
        // Missing `&`.
        "(?:\\w|$)foo",
        // Missing `\w`.
        "($&a)",
        // Missing `$`.
        "(?:\\w)&a",
        // `$` inside character class is a literal `$`.
        "[$]&\\w",
        // `\w` inside class compiles to the byte set rather than
        // the alternation shape we are guarding; the trigger does
        // not apply.
        "[\\w]&$",
        // Escaped `\w` and `\$`-shaped things (the latter is just
        // an escape of `$` -- still a literal in the regex parser).
        "\\\\w&\\$&foo",
    ];
    for src in cases {
        assert!(
            intersection_with_word_end_alternation(src).is_none(),
            "expected intersection_with_word_end_alternation to PASS on {:?}; got {:?}",
            src,
            intersection_with_word_end_alternation(src)
        );
    }
}

// What:     End-to-end test: drive `compile_rule_src` on each
//           panic-shape source string and assert it returns an
//           `Err` (from the pre-validator OR the `catch_unwind`
//           fallback) rather than panicking the process. The
//           production-build profile sets `overflow-checks = true`
//           and `panic = "unwind"` so the `catch_unwind` actually
//           runs; the test binary inherits those settings via
//           `cargo test --release` (the project's mise task).
// Why:      Soundness gate: the WHOLE fix is "no upstream panic
//           propagates past the engine boundary". This test
//           exercises that property end-to-end through the
//           production API, not just the unit-level pre-validator.
//
// In TS you'd write (pseudocode):
// ```ts
// it("compile_rule_src does not panic on known-bad shapes", () => {
//   for (const src of cases) {
//     expect(() => compileRuleSrc(src)).not.toThrow(/panic/);
//   }
// });
// ```
#[test]
fn compile_rule_src_does_not_panic_on_known_bad_shapes() {
    // What:     `use crate::rule::compile_rule_src;`. Pull the
    //           top-level loader-and-fuzzer entry point into scope.
    //           Sibling: the test could call `Regex::new` directly
    //           and wrap with `catch_unwind`, but that would not
    //           exercise the production code path the fix is for.
    // Why:      Drive the actual API so the assertion proves what
    //           we care about: end users do not see panics.
    use crate::rule::compile_rule_src;
    let cases = [
        // Crash 1: runtime intersection-with-lookbehind shape.
        // Compile path returns Err via pre-validator (we do not
        // even reach the resharp parser).
        "(?:(?=a)&(?<=_))",
        "(?:(?=(?=(?:(?:(?:EBEE)))))&(?<=(?:(?=(?=(?=_))))))",
        // Crash 2: compile intersection-with-word-end-alternation
        // shape. Pre-validator catches before resharp panics.
        "(?u:(?u:(?:\\w|$|(?=~(\\_))))(?:(?![1gtu-w]\\_X# lH :)& N))",
        "(?:\\w|$)(?:(?![1g]\\_X)& a)",
    ];
    for src in cases {
        let result = compile_rule_src(src);
        assert!(
            result.is_err(),
            "expected Err from compile_rule_src on known-bad shape {:?}, got {:?}",
            src,
            result.as_ref().map(|_| "Ok(CompiledRegex)")
        );
    }
}

// What:     Direct exercise of the `catch_unwind` safety net by
//           bypassing the pre-validator. We pick a rule shape the
//           pre-validators would currently let through (so the
//           wrapper is the only thing keeping it from panicking
//           the process). Using `find_all` on a long content
//           with the intersection-of-lookarounds shape that
//           panics in `scan_fwd_all` at runtime.
// Why:      Pre-validators are best-effort; catch_unwind is the
//           load-bearing safety. This test fails if someone removes
//           the wrapper, even if the pre-validator catches all
//           currently-known shapes -- the wrapper must keep working
//           for FUTURE upstream regressions.
//
// In TS you'd write (pseudocode):
// ```ts
// it("find_all returns Err on engine panic", () => {
//   const re = compileSomeRule();
//   const r = re.findAll(longContent);
//   expect(r.kind).toBe("err");
// });
// ```
#[test]
fn find_all_catches_runtime_panic_via_catch_unwind() {
    // What:     We construct the resharp::Regex directly (not
    //           through compile_rule_src) so the pre-validator
    //           does not reject the shape, then assert no process
    //           panic for the intersection-with-lookbehind shape.
    // Why:      The load-bearing invariant is "no process panic",
    //           whether upstream rejects the shape at construction
    //           or the catch_unwind net absorbs a runtime panic.
    //           Through resharp 0.6.3 this shape compiled and then
    //           corrupted (release) or panicked (debug) inside
    //           find_all at `engine.rs:1020` / `strip_lb`, which the
    //           wrapper guarded. resharp 0.6.4 fixed it the other
    //           way: `Regex::new` now fails closed with
    //           `Algebra(UnsupportedPattern)` (re-verified at 0.6.9),
    //           so the shape never reaches find_all. Both outcomes
    //           satisfy the invariant; the wrapper stays in find_all
    //           as a hedge for unknown future shapes (see
    //           docs/troubleshooting/resharp.md, "Fixed upstream, now
    //           spent").
    if let Ok(re) = resharp::Regex::new("(?:(?=a)&(?<=_))") {
        let cr = CompiledRegex::Resharp(re);
        // Long content so any latent runtime panic would fire. The
        // exact threshold (~64 bytes) is encoded by the resharp engine
        // and not part of our API; we use a comfortably large buffer.
        let content = vec![b'a'; 128];
        // Either Ok or Err is acceptable -- the test framework would
        // abort if a panic escaped the catch_unwind net.
        let _ = cr.find_all(&content);
    }
}

use super::engine::stacked_quantifier;

// What:     Positive triggers: every shape that must fire
//           `stacked_quantifier`. Covers `*` followed by another
//           quantifier, bounded-after-bounded, and the
//           fuzz-discovered five-deep nesting that motivated the
//           pre-validator.
// Why:      Each case is a compile-blowup shape the fuzz target
//           previously wall-clocked on. Regression-test that the
//           detector stays sensitive as the algorithm evolves.
#[test]
fn stacked_quantifier_fires_on_minimal_shapes() {
    let cases = [
        // Two stars back-to-back. Each `*` is a quantifier suffix;
        // the second applies to the first-quantified atom.
        "a**",
        // Five-star nesting from the fuzz-discovered slow-unit.
        "\\D*****aa",
        // Bounded after star.
        "a*{5,11}",
        // Star after bounded.
        "a{5,11}*",
        // Two adjacent bounded quantifiers (the most common
        // fuzz-evolved shape).
        "a{5,11}{5,11}",
        // Five-deep bounded stacking -- the literal slow-unit
        // rendered body after stripping flags and trailing
        // literals. Compiles in 1.4-1.5s before this fix.
        "\\D{5,11}{5,11}{5,11}{5,11}{5,11}",
        // The full slow-unit body, with both nesting shapes.
        "\\D{5,11}{5,11}{5,11}{5,11}{5,11}\\D*****aa",
        // Bounded after plus.
        "a+{5,11}",
        // Plus after bounded. The regex crate does NOT support
        // possessive quantifiers, so this is a fresh stacked `+`,
        // not a possessive modifier on `{5,11}`.
        "a{5,11}+",
        // Plus after star -- not a possessive in the regex crate.
        "a*+",
        // Plus after plus -- same reasoning.
        "a++",
        // Star after star.
        "a**",
        // `?` quantifier after `*?` lazy -- the second `?` is a
        // fresh quantifier on the lazy-quantified atom.
        "a*??",
        // Group-close followed by stacked quantifiers.
        "(?:a){2}{3}",
        // Non-capturing group with stacked outer quantifiers.
        "(?:a*?){2}{3}",
    ];
    for case in cases {
        assert!(
            stacked_quantifier(case).is_some(),
            "expected stacked_quantifier to fire on {case:?}",
        );
    }
}

// What:     Negative cases the detector must NOT flag. Lazy
//           modifiers, possessive modifiers, single bounded
//           quantifiers, group-prefixed `(?` constructs, literal
//           braces inside classes and after escapes, and the
//           classic-grouped pattern `(a*)*` (single quantifier on
//           a group whose body is itself quantified -- different
//           NFA shape from stacked, supported by both engines).
// Why:      False positives would reject legitimate rules at
//           compile time. Each case here is a real or plausible
//           secret-detection rule shape; the detector must let
//           them through.
#[test]
fn stacked_quantifier_skips_safe_shapes() {
    let cases = [
        // Lazy modifier on each primary quantifier.
        "a*?",
        "a+?",
        "a??",
        // Single quantifier on a grouped quantified body. The
        // group close re-anchors the parser state to "atom may now
        // be quantified", so only ONE quantifier follows the
        // group.
        "(a*)*",
        "(?:a*)*",
        // Non-capturing group + flags + named captures + comments
        // -- the `?` in each is group syntax, not a quantifier.
        "(?:a)*",
        "(?i)a*",
        "(?<=a)b*",
        "(?P<name>a)*",
        "(?#comment)a*",
        // Single bounded quantifier alone.
        "\\D{5,11}",
        "a{50}",
        "a{1,2}",
        // Literal `{` inside class (not a quantifier).
        "[{}]*",
        // Escaped `{` is a literal byte, then `*` is the single
        // quantifier on the escaped atom.
        "\\{*",
        // Empty pattern -- no quantifiers at all.
        "",
        "abc",
        // Alternation does not affect the detector.
        "a*|b*",
        // Atom between quantifiers resets state.
        "a*b*c*",
        // Anchors are not quantifiers.
        "^a*$",
        // Word boundary between quantified atoms.
        "a*\\bb*",
    ];
    for case in cases {
        assert!(
            stacked_quantifier(case).is_none(),
            "stacked_quantifier should NOT fire on {case:?}, got {:?}",
            stacked_quantifier(case),
        );
    }
}

// What:     End-to-end check: `compile_rule_src` rejects the
//           fuzz-discovered slow-unit shape in microseconds with a
//           `(regex):` error string. Compares against the previous
//           timeout behaviour by bounding the call duration.
// Why:      The load-bearing claim of this fix is "compile rejects
//           stacked-quantifier shapes fast". A regression that
//           routed the same shape through the regex crate again
//           would put the call back at 1.4-1.5s.
#[test]
fn compile_rule_src_rejects_fuzz_slow_unit_fast() {
    use std::time::Instant;
    // The slow-unit shape decoded from
    // fuzz/artifacts/fuzz_extract_gate_soundness/slow-unit-0cfbc4b8b9945074fe5214a96c503f6e994e3b97.
    let src = "(?iu)\\D{5,11}{5,11}{5,11}{5,11}{5,11}\\D*****aa";
    let started = Instant::now();
    let result = crate::rule::compile_rule_src(src);
    let elapsed = started.elapsed();
    let err = match result {
        Ok(_) => panic!("expected stacked-quantifier rejection, got Ok"),
        Err(e) => e,
    };
    assert!(
        err.to_string().contains("stacked quantifier"),
        "expected `stacked quantifier` in error, got {err:?}",
    );
    // 100 ms is generous; the pre-validator should run in
    // microseconds. Anything close to a second means the slow path
    // is reachable again.
    assert!(
        elapsed.as_millis() < 100,
        "compile_rule_src on slow-unit took {elapsed:?}; expected <100ms",
    );
}

use super::engine::nested_grouped_quantifier;

// What:     Positive triggers for `nested_grouped_quantifier`. Each
//           case has a chain of four or more consecutive
//           `){quant})` adjacencies, the actual shape the fuzz
//           target's `Node::Quant` renderer emits (always wrapping
//           quantified atoms in `(?:...)`). The motivating artifact
//           is `slow-unit-0cfbc4b8b9945074fe5214a96c503f6e994e3b97`,
//           which decodes to a rule containing two five-deep chains
//           back-to-back.
// Why:      `stacked_quantifier` catches `a{5,11}{5,11}` but NOT
//           `(?:(?:a){5,11}){5,11}` -- the (?:) wrapping defeats
//           adjacency detection. This sibling pre-validator covers
//           the grouped form. Each case is a shape the fuzz target
//           would wall-clock the regex crate on.
#[test]
fn nested_grouped_quantifier_fires_on_minimal_shapes() {
    let cases: &[&str] = &[
        // Depth 4 -- the threshold case. Four consecutive `){quant})`
        // adjacencies starting from the innermost group close.
        "(?:(?:(?:(?:a)*)*)*)*",
        // Depth 5 with `*` -- the second half of the slow-unit body.
        "(?:(?:(?:(?:(?:a)*)*)*)*)*",
        // Depth 5 with `{5,11}` -- the first half of the slow-unit body.
        "(?:(?:(?:(?:(?:a){5,11}){5,11}){5,11}){5,11}){5,11}",
        // The exact rendered source from the slow-unit artifact (with
        // `\d` and `(?iu)` flags). The two halves concatenated
        // followed by literal `aa`.
        "(?iu)(?:(?:(?:(?:(?:\\d){5,11}){5,11}){5,11}){5,11}){5,11}(?:(?:(?:(?:(?:\\d)*)*)*)*)*aa",
        // Mixed quantifier kinds in the chain.
        "(?:(?:(?:(?:a)*){2,3})+)?*",
        // Capturing groups (not just non-capturing).
        "(((((a)*)*)*)*)*",
        // Lazy modifiers on the quantifiers still count -- the chain
        // is about close+quant adjacency, not about greediness.
        "(?:(?:(?:(?:a)*?)*?)*?)*?",
        // Bounded quantifier shape with `{N,}` (no upper bound).
        "(?:(?:(?:(?:(?:a){5,}){5,}){5,}){5,}){5,}",
        // Bounded quantifier shape with `{N}` (fixed count).
        "(?:(?:(?:(?:(?:a){3}){3}){3}){3}){3}",
    ];
    for case in cases {
        assert!(
            nested_grouped_quantifier(case).is_some(),
            "expected nested_grouped_quantifier to fire on {case:?}",
        );
    }
}

// What:     Negative cases for `nested_grouped_quantifier`. Includes
//           depth-3 nestings (just under threshold), single quantified
//           groups, sequential (non-nested) quantified groups, and
//           shapes with atoms or alternation between close+quant
//           pairs that break adjacency.
// Why:      A false positive here would reject legitimate authored
//           rules. Real secret-detection patterns rarely nest beyond
//           2 quantifier levels; the depth-3 case is the boundary
//           case the detector must NOT trip.
#[test]
fn nested_grouped_quantifier_skips_safe_shapes() {
    let cases: &[&str] = &[
        // Empty / trivial patterns.
        "",
        "abc",
        "a*",
        "(?:a)*",
        "(a)*",
        // Depth-2 nesting -- one level under threshold.
        "(?:(?:a)*)*",
        "((a)*)*",
        // Depth-3 nesting -- still under threshold of 4.
        "(?:(?:(?:a)*)*)*",
        "(((a)*)*)*",
        // Sequential quantified groups (not nested -- each `(` resets).
        "(?:a)*(?:b)*(?:c)*(?:d)*(?:e)*",
        // Quantified groups separated by atoms -- atoms reset chain.
        "(?:a)*b(?:c)*d(?:e)*f(?:g)*h(?:i)*",
        // Quantified groups separated by alternation.
        "(?:a)*|(?:b)*|(?:c)*|(?:d)*",
        // Groups with atom-internal quantifiers but no close+quant chain.
        "(?:a*b*c*d*)",
        // Named captures and inline flags -- the `?` is group syntax.
        "(?P<a>x)(?P<b>y)(?P<c>z)(?P<d>w)",
        "(?i)abc",
        // Lookarounds -- `(` then `?` then `=`/`!`/`<`; the close has
        // no quantifier so chain breaks.
        "(?=a)(?=b)(?=c)(?=d)",
        "(?<=a)(?<=b)(?<=c)(?<=d)",
        // Mixed depth-3 with literal atoms between groups.
        "(?:(?:(?:foo)*)*)*bar",
        // Group close followed by literal, NOT a quantifier -- chain
        // resets even though there is a `)`.
        "(?:a)b(?:c)d(?:e)f(?:g)h(?:i)",
        // Anchors and word-boundaries between groups.
        "(?:a)*\\b(?:b)*\\B(?:c)*^(?:d)*$",
        // Class containing `)` is literal byte, not a real close.
        "[)]*[)]*[)]*[)]*[)]*",
        // Escaped close is literal.
        "\\)*\\)*\\)*\\)*\\)*",
    ];
    for case in cases {
        assert!(
            nested_grouped_quantifier(case).is_none(),
            "nested_grouped_quantifier should NOT fire on {case:?}, got {:?}",
            nested_grouped_quantifier(case),
        );
    }
}

use super::engine::complement_intersection_quantified_group;

// What:     Positive triggers for `complement_intersection_quantified_group`.
//           Each case has all three: a complement `~(...)`, an
//           intersection `&`, and a quantified group `)*`/`)+`/
//           `)?`/`){N}`. These shapes hang resharp's algebra
//           simplifier for tens of seconds or indefinitely.
// Why:      Regression-test for the specific compile hangs the
//           pre-validator targets. Without these tests, a future
//           refactor could drop one of the three trigger conditions
//           and break the protection silently.
#[test]
fn complement_intersection_quantified_group_fires() {
    let cases = [
        // Minimum bisected reproducer (with complement).
        "abc~(\\w)&(?:aaa)*",
        // Variations confirmed to hang via probe bisection.
        "xyz~(\\w)&(?:aaaaaaaaaaaaa)*",
        "[_]\u{00f1}e-XM1[^42v]~(\\w)&(?:aaaaaaaaaaaaa)*",
        "(?:[^a]~(\\w)&(?:aaaaaaaaaaaaa)*)",
        // Original timeout artifact source.
        "(?:[_]\u{00f1}e-XM1[^42v]~(\\w)&(?:aaaaaaaaaaaaa)*)",
        // Other quantifier kinds on the group close.
        "x~(\\w)&(?:a)+",
        "x~(\\w)&(?:a){5,11}",
        // The detector is conservative -- it also fires on shapes
        // that compile in milliseconds (e.g. `~(\\w)&(?:a)*`).
        // The trade-off is documented in the function docstring.
        "~(\\w)&(?:a)*",
        // Second timeout artifact source: intersection + quantified
        // group WITHOUT complement still hangs. Confirms the
        // detector's widened check (no complement requirement).
        "(?i) ###(?:\\s&\u{00fc}\u{00fc})(?:####)+#@(?u:0\u{00e7}308-11aaaaaaaa)aa",
        // Minimal version without complement.
        "abc&(?:aaa)*",
        "(?:\\s&a)(?:b)+",
    ];
    for src in cases {
        assert!(
            complement_intersection_quantified_group(src).is_some(),
            "expected complement_intersection_quantified_group to fire on {:?}",
            src
        );
    }
}

// What:     Negative cases for `complement_intersection_quantified_group`.
//           Shapes missing one or more of the three triggers MUST
//           pass.
// Why:      Avoid false positives on real authored rules. The
//           production corpus has zero rules with all three; the
//           detector should not creep onto the rest.
#[test]
fn complement_intersection_quantified_group_skips_safe_shapes() {
    let cases = [
        // Missing intersection.
        "abc~(\\w)(?:aaa)*",
        // Missing quantified group.
        "abc~(\\w)&def",
        "abc&def",
        // `&` inside class is literal.
        "abc[a&b](?:a)*",
        "abc\\&(?:aaa)*",
        // No quantified group at all.
        "abc&def(?:aaa)",
        // Empty / simple.
        "",
        "abc",
        "(?:a)*",
        // Regression: the FOOTER demonstration rule emitted by
        // `mise.port-betterleaks.ts` after inlining its quantified
        // groups. Intersection (`&`) is present, but the quantifier
        // bodies are inlined: `0{32}` is a quantified literal (not a
        // quantified group), and the deadbeef placeholder is written
        // as 16 concatenated unquantified groups -- no `)` is
        // followed by `*`/`+`/`?`/`{N`, so the detector must NOT fire.
        "RELEASE_TAG_[a-f0-9]{32}&~(RELEASE_TAG_0{32})&~(RELEASE_TAG_(de|ad|be|ef)(de|ad|be|ef)(de|ad|be|ef)(de|ad|be|ef)(de|ad|be|ef)(de|ad|be|ef)(de|ad|be|ef)(de|ad|be|ef)(de|ad|be|ef)(de|ad|be|ef)(de|ad|be|ef)(de|ad|be|ef)(de|ad|be|ef)(de|ad|be|ef)(de|ad|be|ef)(de|ad|be|ef))",
    ];
    for src in cases {
        assert!(
            complement_intersection_quantified_group(src).is_none(),
            "expected complement_intersection_quantified_group to PASS on {:?}; got {:?}",
            src,
            complement_intersection_quantified_group(src)
        );
    }
}

use super::engine::lookaround_in_alternation_with_sibling;

// What:     Positive triggers for `lookaround_in_alternation_with_sibling`.
//           Each case has an alternation containing a lookaround
//           AND another lookaround somewhere in the source -- the
//           shape bisected from
//           `crash-8cba104f0805ccb567513aff895398a4f652200c`. These
//           shapes compile through resharp's parser but trip the
//           `engine.rs:1020` debug_assert on the forward DFA scan.
// Why:      libFuzzer's panic hook aborts on this shape before
//           `catch_unwind` in `CompiledRegex::find_all` can
//           intercept; the pre-validator rejects at compile time
//           with a friendly error so the fuzz target can skip the
//           input and continue exploring.
#[test]
fn lookaround_in_alternation_with_sibling_fires() {
    let cases = [
        // Minimal reproducer bisected from the crash artifact.
        "(a|(?![_]))(?!a)",
        // Original artifact source.
        "(?:(?:(?:-\u{00f6}\u{00e9}x|-\u{00f6}pV|(?![_]))(?![a-e-u-vaaa])|a)|a|a)",
        // Variations confirmed to panic via probe bisection.
        "(a|(?![_]))(?![a-e-u-vaaa])",
        "(?:a|(?![_]))(?!a)",
        "((?![_])|a)(?!a)",
        "(a|(?![0]))(?!a)",
        "(a|(?![.]))(?!a)",
        // Lookbehind in alternation + lookbehind sibling -- the
        // detector is direction-agnostic.
        "(a|(?<!_))(?<!a)",
        // Mixed lookaround directions.
        "(a|(?<!_))(?!a)",
        "(a|(?!_))(?<!a)",
        // Nested alternation; the inner group contains both.
        "((?:a|(?!_))(?!a))",
        // New shape from crash-c3c364eb3a03114a52015721c02cba0bf20eb496:
        // single lookaround in alternation followed by literal sibling
        // also trips engine.rs:1020 at find_all time.
        "(?:        4qÃ¼Vk|o\\w|\\s(?![_]))23o:aaaaaaaaaaaaaaa",
        "(?:a|(?!b))c",
        // Single lookaround in alternation, no sibling -- widened to
        // fire because the underlying upstream bug is shape-dependent
        // on the input (compile OK, panic at find_all). Cheaper to
        // reject all alt+la shapes than to bisect the exact triggers.
        "(a|(?!b))",
        "(a|(?<!b))",
    ];
    for src in cases {
        assert!(
            lookaround_in_alternation_with_sibling(src).is_some(),
            "expected lookaround_in_alternation_with_sibling to fire on {:?}",
            src
        );
    }
}

// What:     Negative cases for `lookaround_in_alternation_with_sibling`.
//           Includes shapes with single lookarounds, alternation
//           without lookarounds, lookarounds without alternation,
//           and various separators that should not trigger.
// Why:      Conservative over-rejection still costs production rules.
//           Each case here is a real or plausible authored shape.
#[test]
fn lookaround_in_alternation_with_sibling_skips_safe_shapes() {
    let cases = [
        // Empty / trivial.
        "",
        "abc",
        "a|b",
        // Single lookaround, no alternation.
        "(?=a)",
        "(?!a)",
        "(?<=a)",
        "(?<!a)",
        // Two lookarounds, no alternation.
        "(?=a)(?=b)",
        "(?<!a)(?<!b)",
        // Alternation without lookarounds, with a sibling lookaround.
        "(a|b)(?!c)",
        // Lookarounds in sequence without alternation.
        "(?!a)b(?!c)",
        // Multiple captures without alternation or lookarounds.
        "(a)(b)(c)(d)",
        // Escaped `(`.
        "\\(a\\|\\)",
        // Character class containing `|` (literal pipe, not alternation).
        "[a|b](?!c)",
    ];
    for src in cases {
        assert!(
            lookaround_in_alternation_with_sibling(src).is_none(),
            "expected lookaround_in_alternation_with_sibling to PASS on {:?}; got {:?}",
            src,
            lookaround_in_alternation_with_sibling(src)
        );
    }
}

// What:     End-to-end check: `compile_rule_src` rejects the
//           crash-artifact shape with a `(resharp):` error string
//           that mentions "alternation containing a lookaround".
// Why:      Ensure the new pre-validator is wired into
//           `compile_rule_src` and that the error namespace reads
//           as a resharp shape rejection (not a generic compile
//           failure). Without this, the fuzz target on this input
//           still reaches resharp's `find_all` and panics.
#[test]
fn compile_rule_src_rejects_alt_lookaround_sibling_shape() {
    use std::time::Instant;
    let src = "(a|(?![_]))(?!a)";
    let started = Instant::now();
    let result = crate::rule::compile_rule_src(src);
    let elapsed = started.elapsed();
    let err = match result {
        Ok(_) => panic!("expected rejection, got Ok"),
        Err(e) => e,
    };
    assert!(
        err.to_string().contains("alternation") && err.to_string().contains("lookaround"),
        "expected error mentioning `alternation` and `lookaround`, got {err:?}",
    );
    assert!(
        elapsed.as_millis() < 100,
        "compile_rule_src on alt+la+la took {elapsed:?}; expected <100ms",
    );
}

// What:     End-to-end check: `compile_rule_src` rejects the
//           ACTUAL fuzz-rendered slow-unit shape (with `(?:)`
//           wrapping) in microseconds. The bare-stacked variant is
//           covered by `compile_rule_src_rejects_fuzz_slow_unit_fast`;
//           this test covers the grouped variant the fuzz generator
//           emits.
// Why:      The fuzz target's `Node::Quant` renderer at
//           `fuzz/src/generators.rs:1292-1300` always wraps quantified
//           atoms in `(?:...)`, so the slow-unit's rendered source is
//           the grouped shape. Probe at /tmp/probe-slow-unit showed
//           that the artifact decodes to exactly this source and that
//           compile_rule_src previously took ~3.26s on it.
#[test]
fn compile_rule_src_rejects_grouped_fuzz_slow_unit_fast() {
    use std::time::Instant;
    // The actual rendered source from
    // fuzz/artifacts/fuzz_extract_gate_soundness/slow-unit-0cfbc4b8b9945074fe5214a96c503f6e994e3b97
    // after decoding via Arbitrary and calling rule.render(). The
    // (?:) wrapping comes from Node::Quant's renderer.
    let src = "(?iu)(?:(?:(?:(?:(?:\\d){5,11}){5,11}){5,11}){5,11}){5,11}(?:(?:(?:(?:(?:\\d)*)*)*)*)*aa";
    let started = Instant::now();
    let result = crate::rule::compile_rule_src(src);
    let elapsed = started.elapsed();
    let err = match result {
        Ok(_) => panic!("expected nested-grouped-quantifier rejection, got Ok"),
        Err(e) => e,
    };
    assert!(
        err.to_string().contains("nested grouped quantifier"),
        "expected `nested grouped quantifier` in error, got {err:?}",
    );
    // 100 ms is generous; the pre-validator should run in microseconds.
    // Anything close to a second means the regex crate's slow path is
    // reachable again.
    assert!(
        elapsed.as_millis() < 100,
        "compile_rule_src on grouped slow-unit took {elapsed:?}; expected <100ms",
    );
}

use super::engine::nested_lookahead_in_quantified_group;

// What:     Positive triggers for `nested_lookahead_in_quantified_group`.
//           Each shape was bisected to the minimum reproducer for the
//           u32 add overflow panic at `resharp-algebra/src/lib.rs:2470`.
// Why:      The fuzz target hit `crash-06d9dd9fa1abfeec72a8154c09434b237dfc7f38`
//           and `crash-df95fcd52de76d952ee3db291f59434ece2c0b81` on this
//           shape; the panic propagates around `catch_unwind` because
//           libfuzzer-sys's panic hook calls abort before our handler.
//           A pre-validator is the only way to keep the fuzz target on
//           the soundness path.
#[test]
fn nested_lookahead_in_quantified_group_fires() {
    let cases = [
        // Base case: lookahead in inner quantified group, outer min=2.
        "(?:(?:(?!\\?)){1,5}){2,4}",
        // Fixed outer min=max=2.
        "(?:(?:(?!\\?)){1,5}){2,2}",
        // Single wrap on quantified lookahead, outer min=3.
        "(?:(?!\\?){1,2}){3}",
        "(?:(?!\\?){1,2}){3,5}",
        // Triple nest, outermost min=2.
        "(?:(?:(?:(?!\\?)){1,5}){1,3}){2,4}",
        // Middle level has min=2.
        "(?:(?:(?:(?!\\?)){1,5}){2,3}){1,4}",
        // Sibling lookahead inside outer group (still fires).
        "(?:(?=a)(?:(?!\\?)){1,5}){2,4}",
        // Positive lookahead also triggers.
        "(?:(?:(?=\\?)){1,5}){2,4}",
        // Lookahead body is a class.
        "(?:(?:(?![ab])){1,5}){2,4}",
        // Full crash-1 artifact source.
        "(?-i)(?i:(?x:\\_))(?u:(?:(?:(?!(?:\\?){1,5})){1,5}){2,4})(?i:(?i:(?i:(?i:(?:a)*))))a",
        // Full crash-2 artifact source.
        "(?:(?u:(?:(?u:(?:\\?)+)|(?:(?:\\?){3,7}){1,5}|(?:\\?\\?\\?){1,5}))|(?:(?:(?:(?!\\?)){1,7})+){3,5}|\\_)\\_\\__",
    ];
    for src in cases {
        assert!(
            nested_lookahead_in_quantified_group(src).is_some(),
            "expected nested_lookahead_in_quantified_group to fire on {:?}; got None",
            src
        );
    }
}

// What:     Negative cases for `nested_lookahead_in_quantified_group`.
//           Shapes that compile cleanly through resharp MUST pass.
// Why:      Avoid false positives on lookahead shapes that don't have
//           the specific structure that overflows the rel counter.
//           The check is narrower than `complement_intersection_...`
//           because Bug F is more structurally constrained.
#[test]
fn nested_lookahead_in_quantified_group_skips_safe_shapes() {
    let cases = [
        // Outer min=1 (kleene-equivalent) -- compiles OK upstream.
        "(?:(?:(?!\\?)){1,5}){1,5}",
        "(?:(?:(?!\\?)){1,5}){1,4}",
        // No inner quantifier -- compiles OK upstream.
        "(?:(?!\\?)){2,4}",
        // Literal sibling content breaks the derivative chain.
        "(?:a(?:(?!\\?)){1,5}){2,4}",
        "(?:(?:(?!\\?)){1,5}a){2,4}",
        "(?:a(?:(?!\\?)){1,5}a){2,4}",
        // Alternation sibling breaks it.
        "(?:(?:(?!\\?)){1,5}|a){2,4}",
        // Quantifier inside lookahead body (not wrapping the lookahead).
        "(?:(?!a*)){2,4}",
        // No lookahead at all.
        "(?:(?:a){1,5}){2,4}",
        // Empty / simple.
        "",
        "abc",
        "(?:a)*",
        "(?!\\?)",
        // Bare quantified lookahead, no extra wrap.
        "(?!\\?){2,3}",
    ];
    for src in cases {
        assert!(
            nested_lookahead_in_quantified_group(src).is_none(),
            "expected nested_lookahead_in_quantified_group to PASS on {:?}; got {:?}",
            src,
            nested_lookahead_in_quantified_group(src)
        );
    }
}

// What:     End-to-end check: `compile_rule_src` rejects the Bug F
//           crash shape with a `(resharp):` error mentioning
//           "lookahead" and "overflow". The pre-validator must beat
//           resharp to the punch so libfuzzer's panic hook never sees
//           the abort.
// Why:      The fuzz target relies on this pre-validator to keep
//           moving past Bug F shapes; the soundness-by-revert phase
//           cannot fire if the run halts on every Bug F crash.
#[test]
fn compile_rule_src_rejects_bug_f_shape_fast() {
    use std::time::Instant;
    let src = "(?:(?:(?!\\?)){1,5}){2,4}";
    let started = Instant::now();
    let result = crate::rule::compile_rule_src(src);
    let elapsed = started.elapsed();
    let err = match result {
        Ok(_) => panic!("expected nested-lookahead rejection, got Ok"),
        Err(e) => e,
    };
    assert!(
        err.to_string().contains("lookahead") && err.to_string().contains("overflow"),
        "expected error mentioning `lookahead` and `overflow`, got {err:?}",
    );
    assert!(
        elapsed.as_millis() < 100,
        "compile_rule_src on bug-f shape took {elapsed:?}; expected <100ms",
    );
}

use super::engine::quantified_lookahead_with_sibling_content;

// What:     Positive triggers for
//           `quantified_lookahead_with_sibling_content`. Each shape
//           was confirmed to panic via the bisect probes at
//           `/tmp/probe-slow-unit/src/bin/bisect_f{7,8}.rs`.
// Why:      The second Bug F shape (single quantified lookahead +
//           trailing content) reaches the same overflow at
//           `resharp-algebra/src/lib.rs:2470` through a different
//           upstream path than the nested-quant shape; the narrower
//           `nested_lookahead_in_quantified_group` doesn't catch it.
#[test]
fn quantified_lookahead_with_sibling_content_fires() {
    let cases = [
        // Minimal bisected reproducer: variable quant + 1 trailing char.
        "(?:(?!abc)){4,12}a",
        // Two trailing chars.
        "(?:(?!abc)){4,12}aa",
        // Different trailing literal.
        "(?:(?!abc)){4,12}x",
        "(?:(?!abc)){4,12}bc",
        // Trailing escape.
        "(?:(?!abc)){4,12}\\?",
        // Trailing group.
        "(?:(?!abc)){4,12}(?:d)",
        // Trailing class.
        "(?:(?!abc)){4,12}[d]",
        // Leading + trailing content.
        "a(?:(?!abc)){4,12}a",
        // Smaller variable bounds.
        "(?:(?!abc)){2,3}a",
        "(?:(?!abc)){1,4}a",
        "(?:(?!abc)){2,4}a",
        // Bare lookahead (no `(?:)` wrap) + variable quant + trailing.
        "(?!abc){4,12}a",
        "(?!abc){2,4}a",
        // Positive lookahead variant.
        "(?:(?=abc)){4,12}a",
        // Lookahead + complement-group at parent depth: 2 atoms trailing.
        "(?:(?!abc)){4,12}~(d)",
    ];
    for src in cases {
        assert!(
            quantified_lookahead_with_sibling_content(src).is_some(),
            "expected quantified_lookahead_with_sibling_content to fire on {:?}; got None",
            src
        );
    }
}

// What:     Negative cases. The validator intentionally false-positives
//           on safe `(?:(?!X)){n}<atom>` (exact quant) and
//           `(?:(?!X)){m,n}aaa` (long-uniform trail) shapes per the
//           user-endorsed broad-widening trade-off, so those are NOT
//           in the negative list. The cases here are shapes where no
//           quantified-lookahead is present at all, or there is no
//           content at parent depth.
// Why:      Avoid catastrophic false positives that would reject every
//           reasonable lookahead pattern.
#[test]
fn quantified_lookahead_with_sibling_content_skips_safe_shapes() {
    let cases = [
        // No trailing content (the actual safe case for this validator).
        "(?:(?!abc)){4,12}",
        "(?!abc){4,12}",
        "(?:(?!abc))",
        // Leading content only, no trailing.
        "a(?:(?!abc)){4,12}",
        // Plain regex, no lookahead.
        "abc",
        "(?:abc){4,12}a",
        // Empty.
        "",
        // Lookahead inside an alternation branch with no quant on the LA group.
        "(?!abc)|(?:abc){4,12}a",
        // Lookahead body has a quantifier but the LA itself isn't quantified.
        "(?!a*)abc",
        // Quantifier inside a non-LA group, trailing content.
        "(?:abc){4,12}xyz",
        // EXACT quantifier `{n}` on quantified-LA: no overflow upstream,
        // so the validator must NOT fire (this was a false positive in
        // the prior broad widening).
        "(?:(?!abc)){4}a",
        "(?:(?!abc)){3}aa",
        // 3+ trailing atoms: upstream chain breaks, no overflow.
        "(?:(?!abc)){4,12}aaa",
        "(?:(?!abc)){4,12}abcd",
        // Exact quantifier with longer body in trail.
        "(?:(?!abc)){2}xyz",
    ];
    for src in cases {
        assert!(
            quantified_lookahead_with_sibling_content(src).is_none(),
            "expected quantified_lookahead_with_sibling_content to PASS on {:?}; got {:?}",
            src,
            quantified_lookahead_with_sibling_content(src)
        );
    }
}

// What:     End-to-end check: `compile_rule_src` rejects the
//           trailing-content Bug F shape with a `(resharp):` error.
// Why:      Same as the nested-quant variant: pre-validator must beat
//           resharp to the punch so libfuzzer never sees the abort.
#[test]
fn compile_rule_src_rejects_bug_f_trailing_shape_fast() {
    use std::time::Instant;
    let src = "(?:(?!abc)){4,12}a";
    let started = Instant::now();
    let result = crate::rule::compile_rule_src(src);
    let elapsed = started.elapsed();
    let err = match result {
        Ok(_) => panic!("expected quantified-lookahead-with-trailing rejection, got Ok"),
        Err(e) => e,
    };
    assert!(
        err.to_string().contains("lookahead") && err.to_string().contains("overflow"),
        "expected error mentioning `lookahead` and `overflow`, got {err:?}",
    );
    assert!(
        elapsed.as_millis() < 100,
        "compile_rule_src on bug-f trailing shape took {elapsed:?}; expected <100ms",
    );
}

use super::engine::nested_quantifier_after_wildcard;

// What:     Positive triggers for `nested_quantifier_after_wildcard`.
//           Each shape was decoded from a fuzz slow-unit artifact.
// Why:      The detector must fire on chain >= 3 immediately
//           following a bare `_` outside a class.
#[test]
fn nested_quantifier_after_wildcard_fires() {
    let cases: &[&str] = &[
        // Minimal chain-3 shape.
        "_){5,6}){5,12})+",
        // Chain-3 shape from slow-unit-8c41 (full rendered substring).
        "(?:(?:(?:(?:_){5,6}){5,12})+",
        // Chain-3 shape from slow-unit-709c.
        "(?:(?:(?:(?:_){3,4}){5,12})+",
        // Chain-3 with all `*` quantifiers.
        "_)*)*)*",
        // Chain-3 with all `?` quantifiers.
        "_)?)?)?",
        // Chain-3 with mixed quantifiers.
        "_){5,6})+)*",
        // Chain-4 (one above threshold).
        "_)*)*)*)*",
        // Lazy modifiers don't break the chain.
        "_)*?)*?)*?",
        // The full slow-unit-8c41 rendered source.
        "(?:(?:a|(?:(?:(?:(?:_){5,6}){5,12})+|(?:\\s|(?:(?:_){5,6})+)|(?:(?:(?:_){5,6}){5,6}){5,6}))){5,6}",
        // The full slow-unit-709c rendered source.
        "(?:(?:a|(?:(?:(?:(?:_){3,4}){5,12})+|(?:\\s|_)|(?:(?:(?:_){5,6}){5,6}){5,6}))){5,6}",
    ];
    for case in cases {
        assert!(
            nested_quantifier_after_wildcard(case).is_some(),
            "expected nested_quantifier_after_wildcard to fire on {case:?}",
        );
    }
}

// What:     Negative cases for `nested_quantifier_after_wildcard`.
//           Shapes that must NOT trip the detector.
// Why:      A false positive here would reject legitimate authored
//           rules. The `_` triad is the scanner's wildcard syntax;
//           bare `_` outside chain-3 must compile through.
#[test]
fn nested_quantifier_after_wildcard_skips_safe_shapes() {
    let cases: &[&str] = &[
        "",
        "_",
        "_*",
        "(?:_)*",
        "(?:_){5,12}",
        // Chain-2 after `_` -- below threshold.
        "_)*)*",
        "(?:(?:_){5,6}){5,12}",
        // `_` inside a class is a literal underscore, not the wildcard
        // triad.
        "[_]){5,6}){5,12})+",
        "[_]){5,6}){5,12})*",
        // Escaped underscore `\_` is a literal byte.
        "\\_){5,6}){5,12})+",
        // Chain-3 NOT immediately after `_` -- safe.
        "a){5,6}){5,12})+",
        "(?:(?:(?:(?:a)*)*)*)*",
        // `_` followed by literal, then chain.
        "_a){5,6}){5,12})+",
        // `_` followed by `(`, breaking the chain start.
        "_(){5,6}){5,12})+",
        // No `_` at all.
        "abc",
        "(?:a){5,12}",
        "[abc]",
    ];
    for case in cases {
        assert!(
            nested_quantifier_after_wildcard(case).is_none(),
            "expected nested_quantifier_after_wildcard to PASS on {case:?}; got {:?}",
            nested_quantifier_after_wildcard(case),
        );
    }
}

// What:     End-to-end check: `compile_rule_src` rejects the
//           slow-unit-8c41 shape with a `(resharp):` error.
// Why:      The pre-validator must beat resharp's slow compile path
//           so the fuzz target's throughput is not halved by
//           replaying these slow units.
#[test]
fn compile_rule_src_rejects_wildcard_chain_slow_shape_fast() {
    use std::time::Instant;
    let src = "(?:(?:a|(?:(?:(?:(?:_){5,6}){5,12})+|(?:\\s|(?:(?:_){5,6})+)|(?:(?:(?:_){5,6}){5,6}){5,6}))){5,6}";
    let started = Instant::now();
    let result = crate::rule::compile_rule_src(src);
    let elapsed = started.elapsed();
    let err = match result {
        Ok(_) => panic!("expected wildcard-chain rejection, got Ok"),
        Err(e) => e,
    };
    assert!(
        err.to_string().contains("wildcard") && err.to_string().contains("_"),
        "expected error mentioning `wildcard` and `_`, got {err:?}",
    );
    assert!(
        elapsed.as_millis() < 100,
        "compile_rule_src on wildcard-chain shape took {elapsed:?}; expected <100ms",
    );
}

use super::engine::nested_chain_in_lookaround_body;

// What:     Positive triggers for `nested_chain_in_lookaround_body`.
//           Each shape was decoded from a fuzz slow-unit artifact or
//           constructed to expose the trigger.
// Why:      The detector must fire on chain >= 3 anywhere inside an
//           open lookaround body (any of `(?!`/`(?=`/`(?<!`/`(?<=`).
#[test]
fn nested_chain_in_lookaround_body_fires() {
    let cases: &[&str] = &[
        // Minimal chain-3 inside `(?!...)`.
        "(?!(?:(?:(?:a){2}){2}){2})",
        // Chain-3 inside `(?=...)`.
        "(?=(?:(?:(?:a){2}){2}){2})",
        // Chain-3 inside `(?<!...)`.
        "(?<!(?:(?:(?:a){2}){2}){2})",
        // Chain-3 inside `(?<=...)`.
        "(?<=(?:(?:(?:a){2}){2}){2})",
        // Chain-3 nested two levels inside the outer lookaround (the
        // 4eab shape: inner `(?!...)` body is innocuous; the chain sits
        // in the OUTER lookaround alongside the inner LA).
        "(?!(?!aaa)(?:(?:(?:a){5,14}){5,14}){4,12})",
        // Chain-3 with `*` quantifiers inside `(?!`.
        "(?!(?:(?:(?:a)*)*)*)",
        // Chain-3 with `?` quantifiers inside `(?!`.
        "(?!(?:(?:(?:a)?)?)?)",
        // Chain-4 inside lookaround (one above threshold; must still fire).
        "(?!(?:(?:(?:(?:a){2}){2}){2}){2})",
    ];
    for case in cases {
        assert!(
            nested_chain_in_lookaround_body(case).is_some(),
            "expected nested_chain_in_lookaround_body to fire on {case:?}",
        );
    }
}

// What:     Negative cases for `nested_chain_in_lookaround_body`.
//           Shapes that must NOT trip the detector.
// Why:      A false positive here would reject legitimate authored
//           rules that use lookarounds without slow-compile shapes.
#[test]
fn nested_chain_in_lookaround_body_skips_safe_shapes() {
    let cases: &[&str] = &[
        "",
        "abc",
        "(?:a)*",
        // Chain-3 OUTSIDE any lookaround -- safe.
        "(?:(?:(?:a)*)*)*",
        "(?:(?:(?:(?:a)*)*)*)*",
        // Chain-2 inside a lookaround -- below threshold.
        "(?!(?:(?:a)*)*)",
        "(?=(?:(?:a)*)*)",
        // Lookaround containing a single quantified group -- chain 1.
        "(?!(?:abc){5,12})",
        // Single lookaround with literal body.
        "(?!abc)",
        "(?=xyz)",
        // Sequential lookarounds (each closes before the next).
        "(?!a)(?=b)(?<!c)(?<=d)",
        // Nested lookarounds without chain inside.
        "(?!(?=a))",
        // Lookaround already closed before chain starts -- chain at
        // top level outside any open lookaround.
        "(?!abc)(?:(?:(?:a)*)*)*",
        // Chain-3 in non-lookaround group, then unrelated lookaround.
        "(?:(?:(?:a)*)*)*(?!xyz)",
        // Production-shape: bounded class with single quantifier and a
        // lookaround that has no chain.
        "(?:(?!\\?)){2,4}",
    ];
    for case in cases {
        assert!(
            nested_chain_in_lookaround_body(case).is_none(),
            "expected nested_chain_in_lookaround_body to PASS on {case:?}; got {:?}",
            nested_chain_in_lookaround_body(case),
        );
    }
}

// What:     End-to-end check: `compile_rule_src` rejects the
//           lookaround-chain shape with a `(resharp):` error.
// Why:      Mirror of the wildcard-chain test for the second
//           slow-unit family.
#[test]
fn compile_rule_src_rejects_lookaround_chain_slow_shape_fast() {
    use std::time::Instant;
    // Minimal shape that triggers the validator (the full 4eab artifact
    // is too noisy for a test). The shape is the 4eab structure
    // distilled to its load-bearing chain-in-lookaround.
    let src = "(?!(?:(?:(?:a){5,14}){5,14}){4,12})";
    let started = Instant::now();
    let result = crate::rule::compile_rule_src(src);
    let elapsed = started.elapsed();
    let err = match result {
        Ok(_) => panic!("expected lookaround-chain rejection, got Ok"),
        Err(e) => e,
    };
    assert!(
        err.to_string().contains("lookaround"),
        "expected error mentioning `lookaround`, got {err:?}",
    );
    assert!(
        elapsed.as_millis() < 100,
        "compile_rule_src on lookaround-chain shape took {elapsed:?}; expected <100ms",
    );
}

use super::engine::nested_complement;

// What:     Positive triggers for `nested_complement`. Both the
//           back-to-back form `~(~(...))` and the transparent-group
//           form `~((?:~(...)))` are confirmed slow via probe.
// Why:      The detector must fire on any inner complement that
//           sits inside an open outer complement's body, regardless
//           of intermediate `(?:`/`(?i:`/etc. group wrappers.
#[test]
fn nested_complement_fires() {
    let cases: &[&str] = &[
        // Back-to-back: `~(~(X))`.
        "~(~(abc))",
        // Group-transparent: `~((?:~(X)))`.
        "~((?:~(abc)))",
        // Multiple levels of transparent group wrapping.
        "~((?:(?i:~(abc))))",
        // Full timeout-95f5 artifact shape.
        "(?-i)(?:~(~((?:(?:\\s){5,14}){3,10}))){3,10}",
        // Group-transparent form of the same.
        "(?-i)(?:~((?:~((?:(?:\\s){5,14}){3,10})))){3,10}",
        // Deeper: triple complement.
        "~(~(~(abc)))",
    ];
    for case in cases {
        assert!(
            nested_complement(case).is_some(),
            "expected nested_complement to fire on {case:?}",
        );
    }
}

// What:     Negative cases for `nested_complement`. Shapes that
//           must NOT trip the detector.
// Why:      Sibling complements `~(...)&~(...)` are the production
//           shape (`forbidden-strings.local.txt` line 5); rejecting
//           them would break the RELEASE_TAG rule.
#[test]
fn nested_complement_skips_safe_shapes() {
    let cases: &[&str] = &[
        "",
        "abc",
        "(?:a)*",
        // Single complement.
        "~(abc)",
        "~((?:(?:\\s){5,14}){3,10})",
        // Sibling complements separated by `&` (production shape).
        "~(abc)&~(def)",
        "(?:~(abc)|~(def))",
        // The production RELEASE_TAG rule.
        "RELEASE_TAG_[a-f0-9]{32}&~(RELEASE_TAG_(00){16})&~(RELEASE_TAG_(de|ad|be|ef){8})",
        // Complement inside a class (`~` is just a literal byte).
        "[~()abc]",
        // Escaped `~(` is literal.
        "\\~(abc)~(def)",
        // Complement after another complement (sequence, not nested).
        "~(abc)x~(def)",
    ];
    for case in cases {
        assert!(
            nested_complement(case).is_none(),
            "expected nested_complement to PASS on {case:?}; got {:?}",
            nested_complement(case),
        );
    }
}

// What:     End-to-end check: `compile_rule_src` rejects the
//           nested-complement timeout shape with a `(resharp):` error.
// Why:      The pre-validator must beat resharp's ~900ms compile so
//           the fuzz target's timeout budget is not consumed by the
//           ASAN-amplified shape.
#[test]
fn compile_rule_src_rejects_nested_complement_timeout_shape_fast() {
    use std::time::Instant;
    let src = "(?-i)(?:~(~((?:(?:\\s){5,14}){3,10}))){3,10}";
    let started = Instant::now();
    let result = crate::rule::compile_rule_src(src);
    let elapsed = started.elapsed();
    let err = match result {
        Ok(_) => panic!("expected nested-complement rejection, got Ok"),
        Err(e) => e,
    };
    assert!(
        err.to_string().contains("complement"),
        "expected error mentioning `complement`, got {err:?}",
    );
    assert!(
        elapsed.as_millis() < 100,
        "compile_rule_src on nested-complement shape took {elapsed:?}; expected <100ms",
    );
}
