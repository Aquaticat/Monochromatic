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
