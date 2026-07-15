// What:     Unit tests for the max-lines rule and the code-line classifier it
//           relies on. This is a sibling test module gated by `#[cfg(test)]` in
//           `rule/mod.rs`, so it never reaches the release binary.
// Why:      Lock in the oxlint-matching semantics: blank lines and comments do
//           not count, code-with-trailing-comment does, and `//`/`/* */` inside
//           a string literal must NOT be mistaken for a comment.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("max-lines", () => { it("counts code lines", () => { ... }); });
// ```

// What:     `use std::path::Path;` imports the borrowed-path type used by the
//           exemption tests.
// Why:      `max_lines_exempt` takes a `&Path`.
//
// In TS you'd write (pseudocode):
// ```ts
// import path from "node:path";
// ```
use std::path::Path;

// What:     Four `use crate::...;` imports bring the pieces under test into scope:
//           the exemption predicate and `Config`, the per-file `LintContext`, the
//           `Diagnostic`/`Severity` types, the `Rule` trait, and the `MaxLines`
//           rule itself.
// Why:      The tests build a context, run the rule, and inspect findings.
//
// In TS you'd write (pseudocode):
// ```ts
// import { maxLinesExempt, Config, LintContext, Diagnostic, Severity, Rule, MaxLines } from "...";
// ```
use crate::config::{max_lines_exempt, Config};
use crate::context::LintContext;
use crate::diagnostic::{Diagnostic, Severity};
use crate::rule::Rule;
use crate::builtin::max_lines::MaxLines;

// What:     `fn code_lines(source: &str) -> usize`. Helper that builds a
//           `LintContext` for a fixed fake path and returns its code-line count.
//           `&str` borrows the literal source; `usize` is the count.
// Why:      Most tests only care about the classifier result, so wrap the two
//           construction lines once.
//
// In TS you'd write (pseudocode):
// ```ts
// function codeLines(source: string): number {
//   return LintContext.create("fixture.rs", source).codeLineCount();
// }
// ```
fn code_lines(source: &str) -> usize {
    // What:     `let context = LintContext::new("fixture.rs".to_string(),
    //           source.to_string());`. `.to_string()` allocates owned `String`s
    //           (the constructor takes ownership). The path text is irrelevant to
    //           counting; only the source matters.
    // Why:      Build the context the classifier runs inside.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const context = LintContext.create("fixture.rs", source);
    // ```
    let context = LintContext::new("fixture.rs".to_string(), source.to_string());

    // What:     `context.code_line_count()`. Tail expression: the classifier's
    //           result is returned.
    // Why:      That count is what every classifier test asserts on.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return context.codeLineCount();
    // ```
    context.code_line_count()
}

// What:     `struct Case { source: &'static str, expected: usize }`. A record
//           pairing a source snippet with its expected code-line count.
//           `&'static str` is a program-lifetime borrowed string (all snippets
//           are literals; sibling owned type: `String`).
// Why:      Drive many classifier scenarios from one data table.
//
// In TS you'd write (pseudocode):
// ```ts
// type Case = { source: string; expected: number };
// ```
struct Case {
    source: &'static str,
    expected: usize,
}

// What:     `const CASES: &[Case] = &[ ... ];`. A compile-time constant: a
//           borrowed slice (`&[Case]`) of fixture rows. `&[ ... ]` borrows a
//           fixed array literal. Each row covers one classifier behaviour.
// Why:      One readable table of input-vs-expected; the test below loops it.
//
// In TS you'd write (pseudocode):
// ```ts
// const CASES: Case[] = [ { source: "fn a() {}\n", expected: 1 }, /* ... */ ];
// ```
const CASES: &[Case] = &[
    // one plain code line
    Case { source: "fn a() {}\n", expected: 1 },
    // a whole-line comment counts as zero
    Case { source: "// just a comment\n", expected: 0 },
    // blank lines count as zero
    Case { source: "\n\n\n", expected: 0 },
    // code with a trailing comment is still one code line
    Case { source: "fn a() {} // trailing\n", expected: 1 },
    // a multi-line block comment counts as zero
    Case { source: "/* multi\n   line\n   comment */\n", expected: 0 },
    // a doc comment is still a comment, so zero
    Case { source: "/// doc\nfn a() {}\n", expected: 1 },
    // `//` inside a string literal is NOT a comment; the line is code
    Case { source: "let s = \"// not a comment\";\n", expected: 1 },
    // a string literal spanning two lines makes both lines code
    Case { source: "let s = \"line1\nline2\";\n", expected: 2 },
    // a blank line between code is skipped: lines 1, 3, 4 are code
    Case { source: "fn a() {\n\n    let x = 1;\n}\n", expected: 3 },
];

// What:     `#[test] fn classifier_counts_code_lines() { ... }`. The `#[test]`
//           attribute marks this a test the runner executes.
// Why:      Verify every row of the table.
//
// In TS you'd write (pseudocode):
// ```ts
// it("counts code lines per case", () => { for (const c of CASES) expect(codeLines(c.source)).toBe(c.expected); });
// ```
#[test]
fn classifier_counts_code_lines() {
    // What:     `for case in CASES`. Iterate the borrowed slice; each `case` is a
    //           `&Case`.
    // Why:      Check each scenario.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (const case of CASES) { ... }
    // ```
    for case in CASES {
        // What:     `assert_eq!(code_lines(case.source), case.expected, "source:
        //           {:?}", case.source);`. `assert_eq!` is the macro (the `!`)
        //           that fails the test if the two values differ; the trailing
        //           format args print the offending source. `{:?}` is the debug
        //           format (shows escapes like `\n`).
        // Why:      Pinpoint which row failed.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(codeLines(case.source)).toBe(case.expected);
        // ```
        assert_eq!(code_lines(case.source), case.expected, "source: {:?}", case.source);
    }
}

// What:     `#[test] fn exemptions_match_oxlint_overrides() { ... }`. Checks the
//           path-based skip predicate.
// Why:      Tests, `*_tests.rs`, fuzz, `build.rs`, and the `fixture/`, `fixture/`,
//           `test-fixture/`, `invalid/` sample directories must be exempt; ordinary
//           source must not be.
//
// In TS you'd write (pseudocode):
// ```ts
// it("exempts tests/fuzz/fixture/build.rs", () => { ... });
// ```
#[test]
fn exemptions_match_oxlint_overrides() {
    // What:     `assert!(condition, "msg")`. `assert!` fails the test if the
    //           boolean is false. `Path::new(...)` wraps the literal as a `&Path`.
    //           Each line checks one exempt path shape.
    // Why:      Lock in every exemption category.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // expect(maxLinesExempt("a/tests/foo.rs")).toBe(true);
    // ```
    assert!(max_lines_exempt(Path::new("a/tests/foo.rs")), "tests/ dir");
    assert!(max_lines_exempt(Path::new("a/b/engine_tests.rs")), "*_tests.rs");
    assert!(max_lines_exempt(Path::new("a/fuzz/target.rs")), "fuzz/ dir");
    assert!(max_lines_exempt(Path::new("build.rs")), "build.rs");
    assert!(max_lines_exempt(Path::new("a/fixture/x.rs")), "fixture/ dir");
    assert!(max_lines_exempt(Path::new("a/fixture/x.rs")), "fixture/ dir");
    assert!(max_lines_exempt(Path::new("a/test-fixture/x.rs")), "test-fixture/ dir");
    assert!(max_lines_exempt(Path::new("a/invalid/x.rs")), "invalid/ dir");

    // What:     `assert!(!max_lines_exempt(...))`. The leading `!` negates: assert
    //           the path is NOT exempt.
    // Why:      Ordinary source files must be enforced.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // expect(maxLinesExempt("src/lib.rs")).toBe(false);
    // ```
    assert!(!max_lines_exempt(Path::new("src/lib.rs")), "ordinary source");
}

// What:     `fn run_rule(source: &str, max: usize, path: &str) -> Vec<Diagnostic>`.
//           Helper that runs the `MaxLines` rule over a snippet and returns the
//           findings vector.
// Why:      The three rule tests below differ only in inputs; share the wiring.
//
// In TS you'd write (pseudocode):
// ```ts
// function runRule(source: string, max: number, path: string): Diagnostic[] { /* ... */ }
// ```
fn run_rule(source: &str, max: usize, path: &str) -> Vec<Diagnostic> {
    // What:     `let context = LintContext::new(path.to_string(), source.to_string());`.
    //           Build the per-file context with the given path (so exemptions can
    //           apply) and source.
    // Why:      The rule reads both the code-line count and the path.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const context = LintContext.create(path, source);
    // ```
    let context = LintContext::new(path.to_string(), source.to_string());

    // What:     `let config = Config { max_lines: max };`. Build settings with the
    //           requested budget.
    // Why:      Each test picks a budget relative to the snippet's size.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const config = { maxLines: max };
    // ```
    let config = Config { max_lines: max };

    // What:     `let mut out: Vec<Diagnostic> = Vec::new();`. Empty mutable
    //           findings buffer the rule pushes into.
    // Why:      Capture what the rule reports.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const out: Diagnostic[] = [];
    // ```
    let mut out: Vec<Diagnostic> = Vec::new();

    // What:     `MaxLines.check(&context, &config, &mut out);`. Call the rule's
    //           trait method directly on a `MaxLines` value, lending the context
    //           and config read-only and the buffer mutably.
    // Why:      Exercise the real rule logic, not a reimplementation.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // new MaxLines().check(context, config, out);
    // ```
    MaxLines.check(&context, &config, &mut out);

    // What:     `out`. Tail expression: return the collected findings.
    // Why:      Let each test assert on them.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return out;
    // ```
    out
}

// What:     `#[test] fn over_budget_reports_one_error() { ... }`. A snippet with 3
//           code lines under a budget of 2 must produce exactly one error.
// Why:      The core failing path.
//
// In TS you'd write (pseudocode):
// ```ts
// it("reports an error over budget", () => { ... });
// ```
#[test]
fn over_budget_reports_one_error() {
    // What:     `let found = run_rule("fn a() {\n    let x = 1;\n}\n", 2,
    //           "src/big.rs");`. Three code lines, budget 2, non-exempt path.
    // Why:      Trigger a violation.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const found = runRule("fn a() {\n  let x = 1;\n}\n", 2, "src/big.rs");
    // ```
    let found = run_rule("fn a() {\n    let x = 1;\n}\n", 2, "src/big.rs");

    // What:     `assert_eq!(found.len(), 1);`. Exactly one finding expected.
    // Why:      One file over budget yields one diagnostic.
    assert_eq!(found.len(), 1, "expected exactly one finding");

    // What:     `assert_eq!(found[0].severity, Severity::Error);`. The finding must
    //           be error severity. `found[0]` indexes the first element.
    // Why:      max-lines fails the run, like oxlint's `error` level.
    assert_eq!(found[0].severity, Severity::Error, "must be error severity");
}

// What:     `#[test] fn under_budget_is_clean() { ... }`. Same snippet under a
//           generous budget must produce no findings.
// Why:      The passing path.
//
// In TS you'd write (pseudocode):
// ```ts
// it("is clean under budget", () => { ... });
// ```
#[test]
fn under_budget_is_clean() {
    // What:     `let found = run_rule(..., 10, "src/small.rs");`. Budget 10 over 3
    //           code lines.
    // Why:      No violation expected.
    let found = run_rule("fn a() {\n    let x = 1;\n}\n", 10, "src/small.rs");

    // What:     `assert!(found.is_empty());`. `.is_empty()` is true when the vector
    //           has no elements.
    // Why:      Within budget means nothing to report.
    assert!(found.is_empty(), "under budget should report nothing");
}

// What:     `#[test] fn exempt_path_is_skipped_even_over_budget() { ... }`. An
//           over-budget snippet on an exempt path must still report nothing.
// Why:      Exemptions win over the budget.
//
// In TS you'd write (pseudocode):
// ```ts
// it("skips exempt paths", () => { ... });
// ```
#[test]
fn exempt_path_is_skipped_even_over_budget() {
    // What:     `let found = run_rule(..., 2, "src/foo_tests.rs");`. Three code
    //           lines, tiny budget, but an exempt `*_tests.rs` path.
    // Why:      Confirm the exemption short-circuits before counting matters.
    let found = run_rule("fn a() {\n    let x = 1;\n}\n", 2, "src/foo_tests.rs");

    // What:     `assert!(found.is_empty());`. No findings despite being over budget.
    // Why:      Exempt files are never reported.
    assert!(found.is_empty(), "exempt path must not be reported");
}
