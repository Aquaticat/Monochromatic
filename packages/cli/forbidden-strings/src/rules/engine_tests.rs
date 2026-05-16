// What:     Unit tests for `super::engine::requires_resharp`. Exists
//           as a sibling module so it can reach the `pub` item via
//           `super::engine::...` (sibling modules under the same parent
//           share visibility scope; `pub` is wider than needed but
//           that is what the function carries because external callers
//           re-export it).
// Why:      Compile-time gated by `#[cfg(test)]` in the parent module
//           (`rules.rs`); contributes nothing to the release binary.
//           A separate file (rather than inline `mod tests` inside
//           `engine.rs`) keeps the production source small and lets
//           the test file carry its own dum-dum-non-ts comment density.
// TS map:   `import { requiresResharp } from "./engine";
//           describe("requiresResharp", () => { ... })` in a
//           `*.test.ts` file with Vitest/Jest.
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
// TS map:   `import { requiresResharp } from "./engine";`.
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
// TS map:   `type Case = { pattern: string; expected: boolean };`.
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
// TS map:   `function runCase(c: Case): void { ... }`.
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
    // TS map:   `const actual = requiresResharp(case.pattern);`.
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
    // TS map:   `expect(actual).toBe(case.expected); // with a message`.
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
// TS map:   `test("set algebra amp triggers", () => { runCase(...); });`.
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
    // TS map:   `runCase({ pattern: String.raw\`\(?=foo\)\`, expected: false });`.
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
    // TS map:   `runCase({ pattern: "[(?=]", expected: false });`.
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
    // TS map:   `runCase({ pattern: "(?<=[a-z]) -- (?=[a-z])", expected: true });`.
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
    // TS map:   `runCase({ pattern: "pre_post", expected: true });`.
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
    // TS map:   `runCase({ pattern: String.raw\`pre\\_post\`, expected: false });`.
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
    // TS map:   `runCase({ pattern: "[A-Z_]+", expected: false });`.
    run_case(&Case { pattern: "[A-Z_]+", expected: false });
}

// What:     Tests for `super::engine::lookaround_in_complement`. The
//           function rejects patterns that would make resharp 0.5.x
//           fail at compile time inside a `~(...)` body; this section
//           covers every documented failing shape plus the boundary
//           cases (escaped triggers, class interiors, anchors outside
//           any complement) where the function MUST stay quiet.
// Why:      Regression net. The doc enumerates each shape; each one
//           gets a matching unit test so a future change that misses
//           a category fails loudly. Positive (rejected) and negative
//           (accepted) tests live next to each other so reading the
//           file gives a sense of the function's contract.
// TS map:   `describe("lookaroundInComplement", () => { ... })`.
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
// TS map:   `function assertRejected(pattern: string, substr: string)`.
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
    // TS map:   `assertRejected("em&~(.*foo.*)&~(.*\\bword\\b.*)", "\\b");`.
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
    // TS map:   `assertRejected("em&~((?:foo|\\bword\\b).*)", "\\b");`.
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
    // TS map:   `assertAccepted("em&~(\\Afoo\\z)");`.
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
    // TS map:   `assertAccepted("em&~([^abc].*)");`.
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
    // TS map:   `assertAccepted("em&~(\\\\b.*)");`.
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
    //           in resharp 0.5.x; the restriction is complement-of-
    //           lookaround specifically.
    // Why:      Guard must not reject the prose-em-dash pattern
    //           verified in `prose_em_dash_pattern_triggers`.
    // TS map:   `assertAccepted("(?<=[a-z]) -- (?=[a-z])");`.
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
// TS map:   `import { CompiledRegex } from "./engine";`.
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
// TS map:   `test("is_match returns Result shape", () => { ... });`.
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
