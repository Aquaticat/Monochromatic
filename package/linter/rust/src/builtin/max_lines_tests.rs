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
use crate::config::{default_config, Config};
/// Imports the compiled configuration that exemption resolution runs against.
use crate::config::resolve::LinterConfig;
/// Imports the category the rules under test declare themselves into.
use crate::severity::Category;
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

    // What:     `return context.code_line_count()`. Hands back the classifier's
    //           count for the parsed source.
    // Why:      That count is what every classifier test asserts on.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return context.codeLineCount();
    // ```
    return context.code_line_count()
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

// What:     A test that resolves the SHIPPED default configuration rather than
//           calling a predicate. The two predicates this replaced,
//           `max_lines_exempt` and `missing_rustdoc_exempt`, are gone; the same
//           policy is now the glob `overrides` in the core crate's default.toml.
// Why:      These exemptions are the behaviour users depend on, and they had to
//           survive being re-expressed as configuration. Every path below was
//           asserted by the predicate test this replaces, so a regression in the
//           glob translation fails here.
//
// In TS you'd write (pseudocode):
// ```ts
// it("default config exempts tests/fuzz/fixture/build.rs", () => { ... });
// ```
#[test]
fn exemptions_match_oxlint_overrides() {
    // `LinterConfig::compile` turns the parsed defaults into compiled globs.
    // `.expect(..)` unwraps or fails the test, which is right here: a malformed
    // glob in the shipped defaults is a bug in this crate, not a user error.
    let linter =
        LinterConfig::compile(default_config()).expect("the built-in default.toml must compile");

    // What:     `let exempt = |path: &str| { .. };` binds a CLOSURE, Rust's
    //           arrow function, to a name. It captures `linter` by borrow, so
    //           every call reuses the one compiled configuration.
    // Why:      Each assertion below is about one path; the resolution call
    //           would otherwise be noise repeated nine times.
    let exempt = |path: &str| {
        return !linter
            .resolve(Path::new(path), "builtin", "max-lines", Category::Pedantic)
            .severity
            .is_enabled();
    };

    assert!(exempt("a/tests/foo.rs"), "tests/ dir");
    assert!(exempt("a/b/engine_tests.rs"), "*_tests.rs");
    assert!(exempt("a/fuzz/target.rs"), "fuzz/ dir");
    assert!(exempt("build.rs"), "build.rs at the root");
    assert!(exempt("a/build.rs"), "nested build.rs");
    assert!(exempt("a/fixture/x.rs"), "fixture/ dir");
    assert!(exempt("a/test-fixture/x.rs"), "test-fixture/ dir");
    assert!(exempt("a/invalid/x.rs"), "invalid/ dir");

    // The leading `!` negates. Ordinary source must still be enforced, which is
    // the assertion that catches an over-broad glob turning the rule off for
    // everything.
    assert!(!exempt("src/lib.rs"), "ordinary source");
    assert!(!exempt("a/b/engine.rs"), "ordinary nested source");
}

// What:     The same resolution, for the other rule.
// Why:      README.md claims require-rustdoc has no fixtures carve-out. It is
//           wrong: the predicate it replaced exempted them, and the integration
//           test `undocumented_fixture_in_place_is_exempt` depends on that. This
//           pins the real behaviour so the README can be corrected against it.
#[test]
fn require_rustdoc_shares_the_same_exemptions() {
    let linter =
        LinterConfig::compile(default_config()).expect("the built-in default.toml must compile");

    let exempt = |path: &str| {
        return !linter
            .resolve(
                Path::new(path),
                "builtin",
                "require-rustdoc",
                Category::Pedantic,
            )
            .severity
            .is_enabled();
    };

    assert!(exempt("a/tests/foo.rs"), "tests/ dir");
    assert!(exempt("a/b/engine_tests.rs"), "*_tests.rs");
    assert!(exempt("a/fuzz/target.rs"), "fuzz/ dir");
    assert!(exempt("build.rs"), "build.rs");
    assert!(exempt("a/fixture/x.rs"), "fixture/ dir, contrary to README.md");

    assert!(!exempt("src/lib.rs"), "ordinary source");
}

// What:     A test that the shipped budget is the documented one.
// Why:      The 300 moved out of a Rust literal into default.toml, where a typo
//           would silently loosen the budget for every package.
#[test]
fn default_config_carries_the_documented_budget() {
    let linter =
        LinterConfig::compile(default_config()).expect("the built-in default.toml must compile");

    let resolved = linter.resolve(
        Path::new("src/lib.rs"),
        "builtin",
        "max-lines",
        Category::Pedantic,
    );

    // The default config configures `max`, so an absent options table is a
    // regression rather than a legitimate state.
    let options = resolved.options.expect("max-lines should carry options");

    // `.get("max")` answers `Option<&toml::Value>`; `.and_then(..)` runs the
    // conversion only when present, and `as_integer` answers `Option<i64>`
    // because the configured value might have been of some other TOML type.
    let max = options
        .get("max")
        .and_then(crate::toml::Value::as_integer)
        .expect("max should be an integer");

    assert_eq!(max, 300, "the shipped budget");
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

    // What:     `return out`. Hand back the collected findings.
    // Why:      Let each test assert on them.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return out;
    // ```
    return out
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

// What:     A test asserting the rule does NOT filter by path. It used to assert
//           the opposite, because the rule called `max_lines_exempt` itself.
// Why:      Exemption moved out of the rule and into configuration. Pinning the
//           new division of responsibility matters as much as pinning the old
//           one did: a rule that quietly re-added its own path check would make
//           the `overrides` layer a liar, and no other test would notice.
//
// In TS you'd write (pseudocode):
// ```ts
// it("reports regardless of path; the runner decides", () => { ... });
// ```
#[test]
fn rule_itself_does_not_filter_by_path() {
    // Three code lines, a budget of two, on a path the default config exempts.
    let found = run_rule("fn a() {\n    let x = 1;\n}\n", 2, "src/foo_tests.rs");

    // The rule reports, because the rule only knows about budgets. Silencing it
    // for this path is `exemptions_match_oxlint_overrides`'s subject, and the
    // end-to-end result is covered by the `exempt_file_is_skipped` integration
    // test, which drives the real binary.
    assert_eq!(
        found.len(),
        1,
        "the rule reports on any path it is handed: {found:?}",
    );
}
