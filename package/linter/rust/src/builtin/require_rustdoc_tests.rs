// What:     Unit tests for the require-rustdoc rule. Sibling test module gated by
//           `#[cfg(test)]` in `rule/mod.rs`, so it never reaches the release
//           binary.
// Why:      Lock in the policy: every listed item kind must carry a rustdoc
//           comment (`///` / `//!` / `/** */`), a plain `//` comment does NOT
//           count (the linchpin, since every real file already has `// What:`
//           blocks), and test/fixture paths are skipped.
//
// In TS you'd write (pseudocode):
// ```ts
// describe("require-rustdoc", () => { it("flags undocumented items", () => { ... }); });
// ```

// What:     Three `use crate::...;` imports bring the pieces under test into scope:
//           the per-file `LintContext`, the `Diagnostic`/`Severity` types and the
//           `Config` settings, the `Rule` trait, and the `RequireRustdoc` rule.
// Why:      The tests build a context, run the rule, and inspect findings.
//
// In TS you'd write (pseudocode):
// ```ts
// import { LintContext, Config, Diagnostic, Severity, Rule, RequireRustdoc } from "...";
// ```
use crate::config::Config;
use crate::context::LintContext;
use crate::diagnostic::{Diagnostic, Severity};
use crate::rule::Rule;
use crate::builtin::require_rustdoc::RequireRustdoc;

// What:     `const FILE_MESSAGE: &str = "Missing rustdoc on file.";`. The exact
//           message emitted for a file whose root carries no `//!` module doc.
// Why:      Item-level tests filter this one out so they assert only on item
//           findings, independent of whether the test source documents the file.
//
// In TS you'd write (pseudocode):
// ```ts
// const FILE_MESSAGE = "Missing rustdoc on file.";
// ```
const FILE_MESSAGE: &str = "Missing rustdoc on file.";

// What:     `fn run_rule(source: &str, path: &str) -> Vec<Diagnostic>`. Runs the
//           rule over a snippet at a given path and returns every finding.
// Why:      Shared wiring for all tests below.
//
// In TS you'd write (pseudocode):
// ```ts
// function runRule(source: string, path: string): Diagnostic[] { /* ... */ }
// ```
fn run_rule(source: &str, path: &str) -> Vec<Diagnostic> {
    // What:     `let context = LintContext::new(path.to_string(), source.to_string());`.
    //           `.to_string()` allocates owned `String`s the constructor takes.
    // Why:      The rule reads the parsed tree and path from the context.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const context = LintContext.create(path, source);
    // ```
    let context = LintContext::new(path.to_string(), source.to_string());

    // What:     `let config = Config::with_defaults();`. The rule ignores settings,
    //           but `check` requires a `&Config`.
    // Why:      Satisfy the trait method signature.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const config = withDefaults();
    // ```
    let config = Config::with_defaults();

    // What:     `let mut out: Vec<Diagnostic> = Vec::new();`. Empty mutable buffer
    //           the rule pushes into.
    // Why:      Capture what the rule reports.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const out: Diagnostic[] = [];
    // ```
    let mut out: Vec<Diagnostic> = Vec::new();

    // What:     `RequireRustdoc.check(&context, &config, &mut out);`. Call the rule
    //           directly, lending the context and config read-only and the buffer
    //           mutably.
    // Why:      Exercise the real rule logic.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // new RequireRustdoc().check(context, config, out);
    // ```
    RequireRustdoc.check(&context, &config, &mut out);

    // What:     `out`. Tail expression: return the findings.
    // Why:      Let each test assert on them.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return out;
    // ```
    out
}

// What:     `fn item_findings(source: &str, path: &str) -> Vec<Diagnostic>`. Like
//           `run_rule`, but drops the file-level "Missing rustdoc on file."
//           finding so the result is only the ITEM findings.
// Why:      Every snippet here omits the top-of-file `//!`, so the file is always
//           flagged; filtering it out keeps item-kind assertions clean.
//
// In TS you'd write (pseudocode):
// ```ts
// function itemFindings(source: string, path: string): Diagnostic[] {
//   return runRule(source, path).filter(d => d.message !== FILE_MESSAGE);
// }
// ```
fn item_findings(source: &str, path: &str) -> Vec<Diagnostic> {
    // What:     `run_rule(source, path).into_iter().filter(|d| d.message !=
    //           FILE_MESSAGE).collect()`. `.into_iter()` consumes the vector;
    //           `.filter(closure)` keeps findings whose message is not the
    //           file-level one; `.collect()` rebuilds a `Vec<Diagnostic>`. Tail
    //           expression.
    // Why:      Isolate the item findings under test.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // return runRule(source, path).filter(d => d.message !== FILE_MESSAGE);
    // ```
    run_rule(source, path)
        .into_iter()
        .filter(|d| d.message != FILE_MESSAGE)
        .collect()
}

// What:     `struct Case { source: &'static str, expected: usize }`. A row pairing
//           a snippet with the number of ITEM findings it should produce.
// Why:      Drive many documented/undocumented scenarios from one table.
//
// In TS you'd write (pseudocode):
// ```ts
// type Case = { source: string; expected: number };
// ```
struct Case {
    source: &'static str,
    expected: usize,
}

// What:     `const CASES: &[Case] = &[ ... ];`. One readable table of snippet vs
//           expected item-finding count. In every "1" row, only the single target
//           is left undocumented; everything around it carries a `///`.
// Why:      Cover each documentable kind in both its documented and undocumented
//           shape, plus the `//` linchpin and the `/** */` block form.
//
// In TS you'd write (pseudocode):
// ```ts
// const CASES: Case[] = [ { source: "/// d\nfn a() {}\n", expected: 0 }, /* ... */ ];
// ```
const CASES: &[Case] = &[
    // documented function: clean
    Case { source: "/// d\nfn a() {}\n", expected: 0 },
    // block-form doc comment also counts
    Case { source: "/** d */\nfn a() {}\n", expected: 0 },
    // LINCHPIN: a plain `//` comment is NOT rustdoc, so the fn is still flagged
    Case { source: "// not a doc\nfn a() {}\n", expected: 1 },
    // no comment at all: flagged
    Case { source: "fn a() {}\n", expected: 1 },
    // struct plus a documented field: clean
    Case { source: "/// s\nstruct S {\n    /// f\n    x: u8,\n}\n", expected: 0 },
    // struct documented, field undocumented: one finding (the field)
    Case { source: "/// s\nstruct S {\n    x: u8,\n}\n", expected: 1 },
    // enum plus a documented variant: clean
    Case { source: "/// e\nenum E {\n    /// v\n    A,\n}\n", expected: 0 },
    // enum documented, variant undocumented: one finding (the variant)
    Case { source: "/// e\nenum E {\n    A,\n}\n", expected: 1 },
    // documented constant: clean
    Case { source: "/// c\nconst X: u8 = 1;\n", expected: 0 },
    // undocumented constant: flagged
    Case { source: "const X: u8 = 1;\n", expected: 1 },
    // documented module: clean
    Case { source: "/// m\nmod m {}\n", expected: 0 },
    // undocumented module: flagged
    Case { source: "mod m {}\n", expected: 1 },
    // documented impl block: clean
    Case { source: "/// s\nstruct S;\n/// i\nimpl S {}\n", expected: 0 },
    // struct documented, impl block undocumented: one finding (the impl)
    Case { source: "/// s\nstruct S;\nimpl S {}\n", expected: 1 },
    // trait plus a documented method (no inheritDoc carve-out): clean
    Case { source: "/// t\ntrait T {\n    /// m\n    fn m(&self);\n}\n", expected: 0 },
    // trait documented, method undocumented: one finding (the method)
    Case { source: "/// t\ntrait T {\n    fn m(&self);\n}\n", expected: 1 },
    // documented use: clean
    Case { source: "/// u\nuse std::fmt;\n", expected: 0 },
    // undocumented use: flagged
    Case { source: "use std::fmt;\n", expected: 1 },
];

// What:     `#[test] fn flags_undocumented_items() { ... }`. Runs every table row.
// Why:      Verify the documented/undocumented behaviour per kind.
//
// In TS you'd write (pseudocode):
// ```ts
// it("flags undocumented items per case", () => { for (const c of CASES) ... });
// ```
#[test]
fn flags_undocumented_items() {
    // What:     `for case in CASES`. Iterate the borrowed slice; each `case` is a
    //           `&Case`.
    // Why:      Check each scenario.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // for (const case of CASES) { ... }
    // ```
    for case in CASES {
        // What:     `assert_eq!(item_findings(case.source, "src/x.rs").len(),
        //           case.expected, "source: {:?}", case.source);`. `assert_eq!`
        //           fails the test if the counts differ; `{:?}` debug-prints the
        //           offending source with its escapes.
        // Why:      Pinpoint which row failed.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // expect(itemFindings(case.source, "src/x.rs").length).toBe(case.expected);
        // ```
        assert_eq!(
            item_findings(case.source, "src/x.rs").len(),
            case.expected,
            "source: {:?}",
            case.source,
        );
    }
}

// What:     `#[test] fn plain_line_comment_is_not_rustdoc() { ... }`. The explicit
//           linchpin: a `// What:`-style comment must NOT satisfy the rule.
// Why:      Every real file already has plain `//` blocks; if those counted, the
//           rule would be trivially satisfied and useless.
//
// In TS you'd write (pseudocode):
// ```ts
// it("does not accept plain // comments", () => { ... });
// ```
#[test]
fn plain_line_comment_is_not_rustdoc() {
    // What:     `let found = run_rule("//! f\n// not a doc\nfn a() {}\n",
    //           "src/x.rs");`. The `//!` documents the file; the `// not a doc`
    //           precedes `fn a` but is not a doc comment.
    // Why:      Isolate the fn finding (the file is satisfied by `//!`).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const found = runRule("//! f\n// not a doc\nfn a() {}\n", "src/x.rs");
    // ```
    let found = run_rule("//! f\n// not a doc\nfn a() {}\n", "src/x.rs");

    // What:     `assert_eq!(found.len(), 1, ...)`. Exactly one finding: the fn.
    // Why:      The file is documented; only `fn a` remains.
    assert_eq!(found.len(), 1, "only the fn should be flagged: {found:?}");

    // What:     `assert_eq!(found[0].message, "Missing rustdoc on function \"a\".",
    //           ...)`. The finding must be about the function `a`, not the file.
    // Why:      Proves the `//` did not document `fn a` and the `//!` documented
    //           the file (the finding is the function, named).
    assert_eq!(
        found[0].message, "Missing rustdoc on function \"a\".",
        "message should name the undocumented function",
    );

    // What:     `assert_eq!(found[0].severity, Severity::Error, ...)`. The finding
    //           must be error severity.
    // Why:      require-rustdoc fails the run, like require-tsdoc's `error`.
    assert_eq!(found[0].severity, Severity::Error, "must be error severity");
}

// What:     `#[test] fn file_without_module_doc_is_flagged() { ... }`. A file with
//           no `//!` is itself a violation, separate from its items.
// Why:      Maximal coverage includes the file root.
//
// In TS you'd write (pseudocode):
// ```ts
// it("requires a module doc on the file", () => { ... });
// ```
#[test]
fn file_without_module_doc_is_flagged() {
    // What:     `let found = run_rule("/// d\nfn a() {}\n", "src/x.rs");`. The fn is
    //           documented; the file root has no `//!`.
    // Why:      Isolate the file finding.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const found = runRule("/// d\nfn a() {}\n", "src/x.rs");
    // ```
    let found = run_rule("/// d\nfn a() {}\n", "src/x.rs");

    // What:     `assert_eq!(found.len(), 1, ...)` and the message check. Exactly the
    //           file finding remains (the fn is documented).
    // Why:      Confirm the SOURCE_FILE requirement fires when `//!` is absent.
    assert_eq!(found.len(), 1, "only the file should be flagged: {found:?}");
    assert_eq!(found[0].message, FILE_MESSAGE, "message should name the file");
}

// What:     `#[test] fn documented_file_is_clean() { ... }`. A `//!`-only file with
//           no items reports nothing.
// Why:      Confirm `//!` satisfies the file-level requirement (and that the
//           item-test filter above is sound).
//
// In TS you'd write (pseudocode):
// ```ts
// it("accepts a documented file", () => { ... });
// ```
#[test]
fn documented_file_is_clean() {
    // What:     `let found = run_rule("//! file docs\n", "src/x.rs");`. Just a
    //           module doc, no items.
    // Why:      Nothing should be flagged.
    let found = run_rule("//! file docs\n", "src/x.rs");

    // What:     `assert!(found.is_empty(), ...)`. No findings at all.
    // Why:      A documented file with no items is clean.
    assert!(found.is_empty(), "documented empty file should be clean: {found:?}");
}

// What:     `#[test] fn exempt_paths_are_skipped() { ... }`. Test, fixture, and
//           fuzz paths short-circuit before any check.
// Why:      Throwaway code is off-policy.
//
// In TS you'd write (pseudocode):
// ```ts
// it("skips test/fixture/fuzz paths", () => { ... });
// ```
#[test]
fn exempt_paths_are_skipped() {
    // What:     Seven `assert!(run_rule(..., exempt_path).is_empty(), ...)` checks.
    //           An undocumented fn on each exempt path must produce nothing.
    // Why:      Confirm the exemption short-circuits the whole rule for test, fuzz,
    //           and fixture/invalid sample paths. The `fixture/`, `fixture/`,
    //           `test-fixture/`, and `invalid/` directories hold the linter's own
    //           deliberate negative samples (such as `fixture/undocumented.rs`),
    //           so requiring rustdoc on them would defeat their purpose; this
    //           mirrors oxlint's `ignorePatterns`.
    assert!(run_rule("fn a() {}\n", "src/foo_tests.rs").is_empty(), "*_tests.rs");
    assert!(run_rule("fn a() {}\n", "a/tests/x.rs").is_empty(), "tests/ dir");
    assert!(run_rule("fn a() {}\n", "a/fuzz/x.rs").is_empty(), "fuzz/ dir");
    assert!(run_rule("fn a() {}\n", "a/fixture/x.rs").is_empty(), "fixture/ dir");
    assert!(run_rule("fn a() {}\n", "a/fixture/x.rs").is_empty(), "fixture/ dir");
    assert!(run_rule("fn a() {}\n", "a/test-fixture/x.rs").is_empty(), "test-fixture/ dir");
    assert!(run_rule("fn a() {}\n", "a/invalid/x.rs").is_empty(), "invalid/ dir");

    // What:     `assert!(!run_rule(..., path).is_empty(), ...)`. The leading `!`
    //           negates: an ordinary source path must still be linted.
    // Why:      Guard against the exemption being too broad; production source
    //           outside the exempt directories must keep requiring rustdoc.
    assert!(!run_rule("fn a() {}\n", "src/lib.rs").is_empty(), "ordinary source linted");
}

// What:     `#[test] fn macros_are_never_flagged() { ... }`. Macros are excluded
//           from the documentable set entirely, in any position.
// Why:      rustc emits `unused_doc_comments` for a `///` on a macro invocation
//           ("rustdoc does not generate documentation for macro invocations"), so
//           requiring one there is unsatisfiable; declarative macro definitions
//           are excluded by the same policy. Neither expression-position nor
//           item-position macros may be flagged.
//
// In TS you'd write (pseudocode):
// ```ts
// it("never flags macros", () => { ... });
// ```
#[test]
fn macros_are_never_flagged() {
    // What:     `let expr = item_findings("/// f\nfn a() {\n    println!(\"x\");\n
    //           let v = vec![1];\n}\n", "src/x.rs");`. A documented fn whose body
    //           uses two expression-position macros.
    // Why:      Those macros must NOT be flagged (no valid doc-comment site).
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // const expr = itemFindings("/// f\nfn a() { console.log('x'); const v = [1]; }", "src/x.rs");
    // ```
    let expr = item_findings("/// f\nfn a() {\n    println!(\"x\");\n    let v = vec![1];\n}\n", "src/x.rs");

    // What:     `assert!(expr.is_empty(), ...)`. No item findings: the fn is
    //           documented and the inner macros are skipped.
    // Why:      Expression-position macros are off-policy.
    assert!(expr.is_empty(), "expression macros must be skipped: {expr:?}");

    // What:     `let item = item_findings("some_items! {}\n", "src/x.rs");`. A
    //           macro call at item position (a direct child of the file root).
    // Why:      Item-position macro calls are now excluded too, so this must NOT be
    //           flagged (rustc would warn on a `///` placed there).
    let item = item_findings("some_items! {}\n", "src/x.rs");

    // What:     `assert!(item.is_empty(), ...)`. No findings for an item-position
    //           macro call.
    // Why:      Confirm macros are excluded regardless of position.
    assert!(item.is_empty(), "macros must never be flagged: {item:?}");
}

// What:     `#[test] fn cxx_qt_files_exempt_use_and_trait_impl_methods() { ... }`. In
//           a file that references cxx-qt, `use` imports and trait-impl associated
//           items carry no rustdoc requirement.
// Why:      cxx-qt bridge companion code needs plumbing imports and trait impls
//           (`impl Default`, ...) that the macro and traits demand; requiring docs
//           there is redundant, matching rustc's `missing_docs` (which exempts both).
//
// In TS you'd write (pseudocode):
// ```ts
// it("exempts use + trait-impl methods in cxx-qt files", () => { ... });
// ```
#[test]
fn cxx_qt_files_exempt_use_and_trait_impl_methods() {
    // What:     A cxx-qt file (the `use cxx_qt_lib::QString;` supplies the `cxx_qt_lib`
    //           IDENT that marks it) whose only items are that `use` and a trait-impl
    //           `fn default`; the struct, impl block, and file all carry docs.
    // Why:      The `use` and the trait-impl method are exempt, so the file is clean.
    let source = "//! f\nuse cxx_qt_lib::QString;\n/// s\nstruct S;\n/// i\nimpl Default for S {\n    fn default() -> Self {\n        S\n    }\n}\n";

    // What:     `let found = run_rule(source, "src/x.rs");`. Run over a non-exempt path.
    // Why:      Capture whatever the rule reports.
    let found = run_rule(source, "src/x.rs");

    // What:     `assert!(found.is_empty(), ...)`. Nothing flagged.
    // Why:      cxx-qt detection dropped the `use` and the trait-impl method.
    assert!(found.is_empty(), "cxx-qt file must exempt use + trait-impl method: {found:?}");
}

// What:     `#[test] fn cxx_qt_carveout_is_narrow() { ... }`. The exemption applies
//           ONLY to `use`/trait-impl items and ONLY in cxx-qt files.
// Why:      Guard against over-broad relaxation: inherent-impl methods in a cxx-qt
//           file, and `use`/trait-impl methods in a non-cxx-qt file, stay required.
//
// In TS you'd write (pseudocode):
// ```ts
// it("keeps the cxx-qt carve-out narrow", () => { ... });
// ```
#[test]
fn cxx_qt_carveout_is_narrow() {
    // What:     A cxx-qt file (`use cxx_qt::bridge;` marks it) with a documented
    //           inherent impl whose method is undocumented.
    // Why:      Inherent-impl methods are NOT exempt, so exactly the method is flagged;
    //           the `use` is dropped by the cxx-qt carve-out.
    let inherent = item_findings(
        "use cxx_qt::bridge;\n/// s\nstruct S;\n/// i\nimpl S {\n    fn m(&self) {}\n}\n",
        "src/x.rs",
    );
    assert_eq!(inherent.len(), 1, "cxx-qt inherent-impl method still flagged: {inherent:?}");

    // What:     A NON-cxx-qt file with a bare `use`.
    // Why:      Without a cxx-qt marker the maximal policy holds, so the `use` is flagged.
    let plain_use = item_findings("use std::fmt;\n", "src/x.rs");
    assert_eq!(plain_use.len(), 1, "non-cxx-qt use still flagged: {plain_use:?}");

    // What:     A NON-cxx-qt file with a documented struct + trait impl whose method is
    //           undocumented.
    // Why:      Without a cxx-qt marker the trait-impl method is still flagged.
    let plain_trait_impl = item_findings(
        "/// s\nstruct S;\n/// i\nimpl Default for S {\n    fn default() -> Self {\n        S\n    }\n}\n",
        "src/x.rs",
    );
    assert_eq!(
        plain_trait_impl.len(),
        1,
        "non-cxx-qt trait-impl method still flagged: {plain_trait_impl:?}",
    );
}

// What:     A test that reads the span, not just the message. Every other test
//           in this file asserts on counts and text.
// Why:      The finding's span is what the JSON, unix, and github output formats
//           will report. A span built from the item's LINE can only ever say
//           column 1, so this pins the column to the item's real position and
//           fails if the rule ever goes back through a line-based lookup.
/// An indented item reports the column it starts at, not column 1.
#[test]
fn indented_item_reports_its_real_column() {
    // The inner `fn b` sits four spaces into its line, inside a documented mod.
    let found = item_findings("//! m\n/// outer\nmod outer {\n    fn b() {}\n}\n", "src/x.rs");

    assert_eq!(found.len(), 1, "only the inner fn is undocumented: {found:?}");

    // `.labels[0]` is the primary label; the rule always emits exactly one.
    let span = found[0].labels[0].span;

    assert_eq!(span.line, 4, "the inner fn is on line 4");
    assert_eq!(span.column, 5, "four spaces in, counted one-based");
    assert!(
        span.length > 0,
        "the label should underline the declaration, not collapse to a caret",
    );
}

/// A finding's underline never runs past the line its item starts on.
#[test]
fn multi_line_item_underline_stays_on_one_line() {
    // A function whose body spans three lines; its text range covers all of them.
    let found = item_findings("//! m\nfn wide() {\n    let a = 1;\n}\n", "src/x.rs");

    assert_eq!(found.len(), 1, "one undocumented fn: {found:?}");

    let span = found[0].labels[0].span;

    assert_eq!(span.line, 2, "starts on line 2");
    assert_eq!(
        span.length, 11,
        // `{{` escapes a literal brace: assert_eq! parses this as a format
        // string, so a bare `{` would be read as an interpolation slot.
        "clamped to the `fn wide() {{` line rather than the whole body",
    );
}
