//! Severity levels and the finding record every rule emits.

// What:     `use crate::fix::Fix;` and the two lines under it import types from
//           this same crate. `crate::` means "from this crate's root", never from
//           an external dependency.
// Why:      A diagnostic owns its optional repair and the spans it points at.
//
// In TS you'd write (pseudocode):
// ```ts
// import { Fix } from "./fix";
// ```
/// Imports the repair type a diagnostic may carry.
use crate::fix::Fix;
/// Imports the labelled span type a diagnostic points with.
use crate::span::Label;
/// Imports the source-range type a label underlines.
use crate::span::Span;

// What:     `pub enum Severity { ... }` is a type whose value is exactly one of
//           the listed variants. The compiler checks that every branch inspecting
//           one is handled, which a TS string union cannot promise.
// Why:      Severity decides the exit code and how a finding is labelled.
//
// In TS you'd write (pseudocode):
// ```ts
// type Severity = "error" | "warn";
// ```
/// Reported severity of one finding.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Severity {
    /// Fails the run; exits non-zero.
    Error,

    /// Reported without failing the run, unless warnings are denied.
    Warn,
}

/// Rendering helpers for severity values.
impl Severity {
    // What:     `pub fn label(&self) -> &'static str`. `&self` borrows the value
    //           read-only. `&'static str` is a borrowed string that lives for the
    //           whole program, which every string literal in the source does.
    //           Sibling return type: an owned, heap-allocated `String`.
    // Why:      Borrowed because the two answers are fixed literals; owning them
    //           would allocate on every call for no gain.
    /// Return the lowercase label printed in diagnostic output.
    pub fn label(&self) -> &'static str {
        // `*self` dereferences the borrow back to a value so it can be compared.
        if *self == Severity::Error {
            return "error"
        } else {
            return "warn"
        }
    }
}

// What:     `pub struct Diagnostic { .. }` declares a record with named, OWNED
//           fields, like a TS object type but with ownership made explicit.
// Why:      One value carries everything any output format needs, so adding a
//           format never means revisiting the rules that produce findings. The
//           field set is oxlint's JSON diagnostic shape, so that format is a
//           direct serialization rather than a translation.
//
// In TS you'd write (pseudocode):
// ```ts
// type Diagnostic = {
//   plugin: string; ruleId: string; severity: Severity; message: string;
//   path: string; labels: Label[]; help?: string; url?: string; fix?: Fix;
// };
// ```
/// Complete user-facing finding emitted by one lint rule.
#[derive(Clone, Debug)]
pub struct Diagnostic {
    // What:     `plugin: &'static str`. Borrowed for the program's lifetime,
    //           because plugin names are fixed literals chosen at compile time.
    // Why:      oxlint renders a finding's code as `plugin(rule)`, for example
    //           `eslint(no-debugger)`. Carrying the two halves separately means
    //           formats that want only one half do not have to parse the string
    //           back apart.
    /// Rule package this finding came from, the first half of its reported code.
    pub plugin: &'static str,

    /// Stable rule identifier, the second half of the reported code.
    pub rule_id: &'static str,

    /// Severity controlling output labelling and exit status.
    pub severity: Severity,

    // What:     `message: String`. An OWNED, heap-allocated, growable UTF-8
    //           string. Sibling: `&str`, a borrowed view into text someone else
    //           owns. Owned here because messages interpolate runtime numbers and
    //           must outlive the rule call that built them.
    // Why:      Hold the human-readable explanation.
    /// Human-readable explanation of the finding.
    pub message: String,

    /// File path the finding is in.
    pub path: String,

    // What:     `labels: Vec<Label>`. A growable, heap-allocated, OWNED array,
    //           the counterpart of a TS `Label[]`.
    // Why:      A finding may point at several places at once, such as a
    //           definition and the use that conflicts with it.
    /// Source spans this finding points at, first one being the primary site.
    pub labels: Vec<Label>,

    // What:     `help: Option<String>`. `Option<T>` is how Rust says "may be
    //           absent": either `Some(value)` or `None`. There is no `null`, so
    //           the compiler forces every reader to handle both cases.
    // Why:      Most findings carry no remediation hint, and oxlint omits the key
    //           entirely rather than emitting an empty string.
    /// Remediation hint shown under the message.
    pub help: Option<String>,

    /// Documentation URL for the rule that produced this finding.
    pub url: Option<String>,

    /// Repair this finding proposes, absent when the rule offers none.
    pub fix: Option<Fix>,
}

/// Constructors and rendering helpers for diagnostics.
impl Diagnostic {
    // What:     `pub fn new(..) -> Self` takes the four things no finding can go
    //           without, and defaults everything optional. `impl Into<String>`
    //           accepts either a borrowed literal or an already-owned `String`.
    // Why:      A rule that has nothing but a message and a position should not
    //           have to spell out four `None`s to say so.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // static create(plugin, ruleId, severity, message, path, span): Diagnostic
    // ```
    /// Build a finding with one primary label and no optional detail.
    pub fn new(
        plugin: &'static str,
        rule_id: &'static str,
        severity: Severity,
        message: impl Into<String>,
        path: impl Into<String>,
        span: Span,
    ) -> Self {
        return Self {
            plugin,
            rule_id,
            severity,
            message: message.into(),
            path: path.into(),
            labels: vec![Label::new(span)],
            help: None,
            url: None,
            fix: None,
        }
    }

    // What:     `pub fn with_help(mut self, help: impl Into<String>) -> Self`.
    //           `mut self` takes OWNERSHIP of the value, mutates it, and hands it
    //           back, so calls chain: `Diagnostic::new(..).with_help(..)`. Taking
    //           `&mut self` instead would force callers to bind a variable first.
    // Why:      Optional detail reads as a chain rather than as a struct literal
    //           listing every absent field.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // withHelp(help: string): Diagnostic { this.help = help; return this; }
    // ```
    /// Attach a remediation hint, returning the diagnostic for chaining.
    pub fn with_help(mut self, help: impl Into<String>) -> Self {
        self.help = Some(help.into());
        return self
    }

    /// Attach a documentation URL, returning the diagnostic for chaining.
    pub fn with_url(mut self, url: impl Into<String>) -> Self {
        self.url = Some(url.into());
        return self
    }

    /// Attach a proposed repair, returning the diagnostic for chaining.
    pub fn with_fix(mut self, fix: Fix) -> Self {
        self.fix = Some(fix);
        return self
    }

    /// Replace this finding's labels wholesale, returning it for chaining.
    pub fn with_labels(mut self, labels: Vec<Label>) -> Self {
        self.labels = labels;
        return self
    }

    // What:     `pub fn line(&self) -> usize`. Reads the primary label's line.
    //           `.first()` returns `Option<&Label>` because the collection may be
    //           empty; `.map_or(default, closure)` returns `default` for `None`
    //           and otherwise runs the closure. `|label| ..` is the closure, which
    //           is Rust's arrow function.
    // Why:      Every output format wants the primary line, and reaching through
    //           `labels[0]` at each of them would panic on an unlabelled finding.
    //
    // In TS you'd write (pseudocode):
    // ```ts
    // get line(): number { return this.labels[0]?.span.line ?? 1; }
    // ```
    /// Return the one-based line of the primary label, or 1 when unlabelled.
    pub fn line(&self) -> usize {
        return self.labels.first().map_or(1, |label| return label.span.line)
    }

    // What:     `pub fn column(&self) -> usize`. Reads the primary label's
    //           column, the sibling of `line` above.
    // Why:      Every renderer prints `line:column`, and reaching through
    //           `labels[0]` at each of them would panic on an unlabelled finding.
    /// Return the one-based column of the primary label, or 1 when unlabelled.
    pub fn column(&self) -> usize {
        return self.labels.first().map_or(1, |label| return label.span.column);
    }

    /// Return the primary label's span end line, for renderers that report ranges.
    pub fn end_line(&self) -> usize {
        return self.labels.first().map_or(1, |label| return label.span.line);
    }

    /// Return the primary label's end column, for renderers that report ranges.
    pub fn end_column(&self) -> usize {
        return self
            .labels
            .first()
            .map_or(1, |label| return label.span.column + label.span.length);
    }

    /// Return the reported code in oxlint's `plugin(rule)` form.
    pub fn code(&self) -> String {
        // `format!` is the macro, marked by its `!`, that builds an owned String
        // from a template the way a TS template literal does.
        return format!("{}({})", self.plugin, self.rule_id)
    }

    /// Render this diagnostic as one CLI output line.
    pub fn render(&self) -> String {
        return format!(
            "{}:{}: {}[{}]: {}",
            self.path,
            self.line(),
            self.severity.label(),
            self.rule_id,
            self.message,
        )
    }
}
