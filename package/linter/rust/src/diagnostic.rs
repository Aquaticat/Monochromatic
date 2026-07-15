//! Diagnostic severity, payload, and rendering types.

// What:     `pub enum Severity { Error, Warn }` declares a type with exactly two
//           named values (a "sum type" / "tagged union"). `pub` makes it visible
//           outside this file.
// Why:      A rule needs to say whether a finding fails the run (Error) or is
//           advisory (Warn). Only error-severity findings set a non-zero exit.
//
// In TS you'd write (pseudocode):
// ```ts
// type Severity = "error" | "warn";
// ```
/// Severity level attached to one diagnostic.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Severity {
    /// Finding that fails the linter run.
    Error,
    /// Advisory finding that does not fail the linter run.
    Warn,
}

// What:     `impl Severity { ... }` opens a block of methods attached to the
//           `Severity` type.
// Why:      Give `Severity` a way to render itself as text for output.
//
// In TS you'd write (pseudocode):
// ```ts
// // methods on Severity would live in a class or as free functions
// ```
/// Rendering helpers for diagnostic severity values.
impl Severity {
    // What:     `pub fn label(&self) -> &'static str`. `&self` borrows the value
    //           (read-only) instead of consuming it. `&'static str` is a
    //           borrowed string slice whose bytes live for the whole program
    //           (here, string literals baked into the binary). Sibling type:
    //           `String`, a heap-allocated owned string we would return if the
    //           text were computed at runtime.
    // Why:      Map each variant to the word printed in diagnostics.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // label(): string { return this; }
    // ```
    /// Return the lowercase label printed in diagnostic output.
    pub fn label(&self) -> &'static str {
        // What:     `if *self == Severity::Error { ... } else { ... }`. `*self`
        //           dereferences the borrowed `&self` back to a `Severity` value
        //           so it can be compared. The whole `if/else` is the function's
        //           tail expression, so its value is returned.
        // Why:      Pick the right label without a `match`, keeping it as a plain
        //           two-branch conditional a TS reader recognises.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return this === "error" ? "error" : "warn";
        // ```
        if *self == Severity::Error {
            "error"
        } else {
            "warn"
        }
    }
}

// What:     `pub struct Diagnostic { ... }` declares a record type with named,
//           OWNED fields. A struct is like a TS object type, but each field's
//           ownership is explicit.
// Why:      One value carries everything we print about a single finding: which
//           rule, how severe, the human message, the file, and the 1-based line.
//
// In TS you'd write (pseudocode):
// ```ts
// type Diagnostic = {
//   ruleId: string; severity: Severity; message: string; path: string; line: number;
// };
// ```
/// Complete user-facing finding emitted by one lint rule.
#[derive(Clone, Debug)]
pub struct Diagnostic {
    // What:     `rule_id: &'static str`. A borrowed string slice living for the
    //           whole program. Sibling: `String` (owned, heap). We use the
    //           borrowed form because rule ids are fixed literals like "max-lines".
    // Why:      Identify which rule produced the finding.
    /// Stable lint rule identifier.
    pub rule_id: &'static str,

    // What:     `severity: Severity`. One of the two-variant enum above, stored
    //           by value (it is `Copy`, so it is duplicated cheaply, not moved).
    // Why:      Decide exit code and how to label the line.
    /// Severity that controls output labeling and exit status.
    pub severity: Severity,

    // What:     `message: String`. An OWNED, heap-allocated, growable UTF-8
    //           string. Sibling: `&str`, a borrowed view. We own it because the
    //           message is built at runtime (it contains numbers) and must
    //           outlive the function that created it.
    // Why:      Hold the human-readable explanation.
    /// Human-readable explanation of the finding.
    pub message: String,

    // What:     `path: String`. OWNED string holding the file path as text.
    //           Sibling: `&str` or `std::path::Path`; we keep a plain owned
    //           `String` because it is only ever printed, never traversed.
    // Why:      Tell the reader which file the finding is in.
    /// File path associated with the finding.
    pub path: String,

    // What:     `line: usize`. `usize` is the unsigned integer wide enough to
    //           index any element in memory (32-bit on a 32-bit OS, 64-bit on a
    //           64-bit OS). Siblings: `u32`, `u64`, `i32`, `i64`. 1-based.
    // Why:      `usize` because line numbers are counts/indices, which every Rust
    //           collection API expresses as `usize`; mixing widths forces casts.
    /// One-based source line associated with the finding.
    pub line: usize,
}

// What:     `impl Diagnostic { ... }` attaches methods to the record type.
// Why:      Give a diagnostic a way to render itself as one output line.
//
// In TS you'd write (pseudocode):
// ```ts
// function renderDiagnostic(d: Diagnostic): string { /* ... */ }
// ```
/// Rendering helpers for diagnostic values.
impl Diagnostic {
    // What:     `pub fn render(&self) -> String`. Borrows the diagnostic
    //           read-only (`&self`) and returns a freshly built OWNED `String`.
    // Why:      Produce the single line printed per finding.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // render(): string {
    //   return `${this.path}:${this.line}: ${this.severity}[${this.ruleId}]: ${this.message}`;
    // }
    // ```
    /// Render this diagnostic as one CLI output line.
    pub fn render(&self) -> String {
        // What:     `format!(...)` is the macro (the `!`) that builds a new
        //           `String` from a template, like a template literal. `{}`
        //           slots interpolate the arguments in order; `self.severity
        //           .label()` calls the method defined above.
        // Why:      Assemble `path:line: severity[rule]: message`. This is the
        //           function's tail expression, so it is the returned value.
        //
        // In TS you'd write (pseudocode):
        // ```ts
        // return `${this.path}:${this.line}: ${this.severity}[${this.ruleId}]: ${this.message}`;
        // ```
        format!(
            "{}:{}: {}[{}]: {}",
            self.path,
            self.line,
            self.severity.label(),
            self.rule_id,
            self.message,
        )
    }
}
