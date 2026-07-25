//! Max-lines rule implementation.

// What:     `use crate::config::{max_lines_exempt, Config};` imports two names
//           from this crate's config module: the exemption predicate and the
//           settings struct.
// Why:      The rule needs the budget (from `Config`) and the skip check.
//
// In TS you'd write (pseudocode):
// ```ts
// import { maxLinesExempt, Config } from "../config";
// ```
/// Imports max-lines configuration and exemption predicate.
use crate::config::{max_lines_exempt, Config};

// What:     `use crate::span::Span;` reaches the source-range type through this
//           crate's re-export of the core crate's module.
// Why:      A diagnostic points at a range, and this rule builds that range from
//           the line whose budget it objects to.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Span } from "./span";
// ```
/// Imports the source-range type carried by every diagnostic label.
use crate::span::Span;

// What:     `use crate::context::LintContext;` imports the per-file bundle type.
// Why:      The rule reads code-line data from it.
//
// In TS you'd write (pseudocode):
// ```ts
// import { LintContext } from "../context";
// ```
/// Imports parsed per-file context.
use crate::context::LintContext;

// What:     `use crate::diagnostic::{Diagnostic, Severity};` imports the finding
//           record and its severity enum.
// Why:      The rule constructs a `Diagnostic` with `Severity::Error`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Diagnostic, Severity } from "../diagnostic";
// ```
/// Imports diagnostic payload and severity types.
use crate::diagnostic::{Diagnostic, Severity};

// What:     `use crate::rule::Rule;` imports the trait this rule implements.
// Why:      Needed so we can write `impl Rule for MaxLines`.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Rule } from "../rule";
// ```
/// Imports rule trait implemented by this rule.
use crate::rule::Rule;

// What:     `use std::path::Path;` imports the borrowed-path type.
// Why:      The exemption check takes a `&Path`; we build one from the path string.
//
// In TS you'd write (pseudocode):
// ```ts
// import path from "node:path";
// ```
/// Imports path helper used by exemption checks.
use std::path::Path;

// What:     `pub struct MaxLines;`. A UNIT struct: a type with no fields, written
//           without braces. It carries no data; it exists only to implement the
//           `Rule` trait.
// Why:      Rules are values so they can live together in a `Vec<Box<dyn Rule>>`;
//           this one needs no state.
//
// In TS you'd write (pseudocode):
// ```ts
// class MaxLines implements Rule { /* no fields */ }
// ```
/// Rule enforcing maximum code lines per Rust file.
pub struct MaxLines;

// What:     `impl Rule for MaxLines { ... }`. Provides the trait's methods for the
//           `MaxLines` type. This is how Rust says "MaxLines satisfies the Rule
//           interface".
// Why:      So the runner can hold it as a `Box<dyn Rule>` and call `check`.
//
// In TS you'd write (pseudocode):
// ```ts
// class MaxLines implements Rule { id() { return "max-lines"; } check(...) { ... } }
// ```
/// Rule trait implementation for the max-lines check.
impl Rule for MaxLines {
    // What:     `fn id(&self) -> &'static str { "max-lines" }`. Returns the fixed
    //           rule id. `&'static str` is a program-lifetime borrowed string.
    // Why:      Identify this rule in diagnostics and (later) config.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // id(): string { return "max-lines"; }
    // ```
    /// Return max-lines rule identifier.
    fn id(&self) -> &'static str {
        return "max-lines"
    }

    // What:     `fn allows_suppression(&self) -> bool { false }`. The trait gives
    //           this method no default body, so every rule has to answer.
    // Why:      `false`, because AGENTS.md MXL and MXR say the budget is never
    //           disabled: the remedy for an over-budget file is to split it, not
    //           to comment the rule away. A directive aimed at this rule is
    //           therefore itself reported rather than obeyed.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // allowsSuppression(): boolean { return false; }
    // ```
    /// Refuse inline suppression, per the never-disable policy for this rule.
    fn allows_suppression(&self) -> bool {
        return false
    }

    // What:     `fn check(&self, context: &LintContext, config: &Config, out: &mut
    //           Vec<Diagnostic>)`. Read-only borrows of the file context and
    //           config; a mutable borrow of the shared findings vector to push into.
    // Why:      Inspect one file and append a finding if it busts the budget.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // check(ctx: LintContext, cfg: Config, out: Diagnostic[]): void { /* ... */ }
    // ```
    /// Append a diagnostic when a nonexempt file exceeds configured budget.
    fn check(&self, context: &LintContext, config: &Config, out: &mut Vec<Diagnostic>) {
        // What:     `let path = Path::new(&context.path);`. `Path::new` wraps the
        //           borrowed string (`&context.path`, a `&String` that coerces to
        //           `&str`) as a `&Path` without copying.
        // Why:      The exemption check works on path segments, which `Path` exposes.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const p = ctx.path;
        // ```
        let path = Path::new(&context.path);

        // What:     `if max_lines_exempt(path) { return; }`. Calls the predicate
        //           and bails out early when the file is exempt.
        // Why:      Tests, fuzz harnesses, fixtures, and build scripts are
        //           off-budget, mirroring oxlint's overrides.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (maxLinesExempt(p)) return;
        // ```
        if max_lines_exempt(path) {
            return;
        }

        // What:     `let count = context.code_line_count();`. Reads how many code
        //           lines (blanks and comments already excluded) the file has.
        // Why:      This count is what we compare against the budget.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const count = ctx.codeLineCount();
        // ```
        let count = context.code_line_count();

        // What:     `if count <= config.max_lines { return; }`. Within budget, so
        //           there is nothing to report.
        // Why:      Only over-budget files produce a finding.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // if (count <= cfg.maxLines) return;
        // ```
        if count <= config.max_lines {
            return;
        }

        // What:     `let line = context.code_line_at(config.max_lines).unwrap_or(1);`.
        //           `code_line_at(config.max_lines)` returns `Option<usize>`: the
        //           line number of the first code line PAST the budget (0-based
        //           index `max_lines` is the `max_lines+1`-th code line).
        //           `.unwrap_or(1)` extracts the inner number, or substitutes `1`
        //           if absent (it never is here, since `count > max_lines`).
        // Why:      Point the diagnostic at the first offending line.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const line = ctx.codeLineAt(cfg.maxLines) ?? 1;
        // ```
        let line = context.code_line_at(config.max_lines).unwrap_or(1);

        // What:     `let message = format!(...)`. Builds an OWNED `String` via the
        //           formatting macro, interpolating the actual count and budget.
        // Why:      Explain the violation to the reader.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // const message = `file has ${count} code lines, limit is ${cfg.maxLines} (blank and comment lines excluded)`;
        // ```
        let message = format!(
            "file has {count} code lines, limit is {} (blank and comment lines excluded)",
            config.max_lines,
        );

        // What:     `out.push(Diagnostic { ... });`. Appends a new finding to the
        //           shared vector. The struct literal fills every field;
        //           `rule_id: "max-lines"` is a borrowed literal, `severity:
        //           Severity::Error` selects the failing variant, and
        //           `path: context.path.clone()` makes an OWNED copy of the path
        //           string (`.clone()` deep-copies the `String`) because the
        //           diagnostic outlives this borrow of `context`.
        // Why:      Record the violation; its presence will drive a non-zero exit.
        // Gotcha:   `.clone()` here is a real heap copy of the string, not a cheap
        //           reference bump; we accept it because findings are rare.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // out.push(Diagnostic.create("builtin", "max-lines", "error", message, ctx.path, span));
        // ```
        // `.unwrap_or_else(closure)` supplies a fallback only when the lookup came
        // back absent, computing it lazily rather than eagerly the way
        // `.unwrap_or(value)` would. The fallback points at the file's start,
        // which is the honest answer when the offending line is past the end.
        let span = context
            .line_span(line)
            .unwrap_or_else(|| return Span::at(0, line, 1));

        out.push(Diagnostic::new(
            "builtin",
            "max-lines",
            Severity::Error,
            message,
            context.path.clone(),
            span,
        ));
    }
}
