//! Applying directives to findings, and reporting the ones that did nothing.

/// Imports the finding record suppression filters.
use crate::diagnostic::{Diagnostic, Severity};
/// Imports the parsed directive types being applied.
use crate::directive::{Directive, DirectiveKind};
/// Imports the configured severity used to report directive problems.
use crate::severity::RuleSeverity;

// What:     `pub const UNUSED_RULE: &str = "unused-disable-directive";` and its
//           sibling below name the two rules this module reports under.
// Why:      A directive problem is itself a finding, so it needs a rule id like
//           any other. Naming them here keeps the strings out of the three
//           places that build these diagnostics.
/// Rule id reported when a directive suppresses nothing.
pub const UNUSED_RULE: &str = "unused-disable-directive";

/// Rule id reported when a directive is malformed or forbidden.
pub const INVALID_RULE: &str = "invalid-disable-directive";

// What:     `pub struct Suppression { .. }` is what applying directives
//           produces: the findings that survived, plus the findings the
//           directives themselves provoked.
// Why:      Both come out of one walk. Returning them separately would mean
//           either walking twice or leaving the caller to sort them apart.
/// Outcome of applying a file's directives to its findings.
pub struct Suppression {
    /// Findings that were not suppressed.
    pub kept: Vec<Diagnostic>,

    /// Findings about the directives themselves.
    pub directive_problems: Vec<Diagnostic>,
}

// What:     `pub fn apply(..) -> Suppression`. `suppressible` is a `&dyn Fn(&str,
//           &str) -> bool`: a borrowed CLOSURE, so the caller decides what
//           counts as suppressible without this module knowing about rules.
// Why:      Whether a rule may be silenced is declared on the rule itself, and
//           the rule registry lives in the CLI crate. Taking a closure keeps
//           this module from depending on it.
//
// In TS you'd write (pseudocode):
// ```ts
// function apply(directives, diagnostics, path, unusedSeverity, suppressible): Suppression
// ```
/// Apply a file's directives to its findings.
pub fn apply(
    directives: &[Directive],
    diagnostics: Vec<Diagnostic>,
    path: &str,
    unused_severity: Option<RuleSeverity>,
    suppressible: &dyn Fn(&str, &str) -> bool,
) -> Suppression {
    // What:     `vec![false; directives.len()]` builds a vector of that length
    //           filled with `false`, one flag per directive.
    // Why:      A directive is unused only if NOTHING it could have suppressed
    //           appeared, so the answer is only known after every finding has
    //           been considered.
    let mut used = vec![false; directives.len()];

    let mut kept = Vec::new();
    let mut directive_problems = Vec::new();

    for diagnostic in diagnostics {
        // `.iter().enumerate()` pairs each directive with its index, which is
        // what the `used` flags are keyed by.
        let matched = directives.iter().enumerate().find(|(_, directive)| {
            return governs(directives, directive, diagnostic.line())
                && directive.targets(diagnostic.plugin, diagnostic.rule_id);
        });

        let Some((index, directive)) = matched else {
            kept.push(diagnostic);
            continue;
        };

        // A directive aimed at a rule that refuses suppression is itself the
        // violation. The finding survives, and the directive is reported.
        if !suppressible(diagnostic.plugin, diagnostic.rule_id) {
            directive_problems.push(forbidden_diagnostic(directive, &diagnostic, path));
            kept.push(diagnostic);

            // Marked used despite suppressing nothing, so the unused-directive
            // report stays quiet about it. It has already been reported once,
            // with a message that says what is actually wrong; calling it
            // "unused" as well would be two complaints for one mistake.
            used[index] = true;
            continue;
        }

        // A directive with no justification does not suppress. AGENTS.md LN5
        // requires one, and a directive that silenced a rule while explaining
        // nothing would be the exact thing that rule exists to prevent.
        if directive.justification.is_none() {
            directive_problems.push(unjustified_diagnostic(directive, path));
            kept.push(diagnostic);
            used[index] = true;
            continue;
        }

        used[index] = true;
    }

    // Report directives that suppressed nothing, when asked to.
    if let Some(severity) = unused_severity
        && let Some(reported) = severity.as_diagnostic()
    {
        for (index, directive) in directives.iter().enumerate() {
            // An `enable` closes a range rather than suppressing anything, so it
            // is never "unused" in the sense this reports.
            if directive.kind == DirectiveKind::Enable || used[index] {
                continue;
            }

            directive_problems.push(unused_diagnostic(directive, path, reported));
        }
    }

    return Suppression {
        kept,
        directive_problems,
    };
}

// What:     `fn governs(all: &[Directive], directive: &Directive, line: usize)
//           -> bool`. Answers for every kind, including the ranged one, which
//           needs the whole list to find its closing `enable`.
// Why:      `Directive::governs` can answer for the two single-line kinds alone,
//           but a `disable` runs until something else ends it, and only the full
//           list knows what that is.
/// Report whether a directive governs the given line.
fn governs(all: &[Directive], directive: &Directive, line: usize) -> bool {
    if directive.kind != DirectiveKind::Disable {
        return directive.governs(line);
    }

    // A ranged disable starts on its own line.
    if line < directive.line {
        return false;
    }

    // What:     `.filter(..).map(..).min()` finds the nearest `enable` after
    //           this `disable`. `.min()` answers `Option` because there may be
    //           none, in which case the range runs to end of file.
    // Why:      The nearest one closes the range; a later one belongs to some
    //           other disable.
    let closing = all
        .iter()
        .filter(|candidate| {
            return candidate.kind == DirectiveKind::Enable && candidate.line > directive.line;
        })
        .map(|candidate| return candidate.line)
        .min();

    // What:     `.is_none_or(closure)` is true when the value is absent OR the
    //           closure accepts it.
    // Why:      With no closing enable the range covers every later line, and
    //           with one it covers the lines before it. That is exactly what
    //           "absent, or before the end" says, and clippy prefers it over
    //           the `map_or(true, ..)` spelling of the same thing.
    return closing.is_none_or(|end| return line < end);
}

/// Build the finding reported when a directive targets a non-suppressible rule.
fn forbidden_diagnostic(directive: &Directive, target: &Diagnostic, path: &str) -> Diagnostic {
    return Diagnostic::new(
        "builtin",
        INVALID_RULE,
        Severity::Error,
        format!(
            "Rule \"{}\" cannot be suppressed, so this rust-linter-{} directive has no effect.",
            target.code(),
            directive.kind.name(),
        ),
        path,
        directive.span,
    )
    .with_help("Fix the reported problem instead; this rule is never disabled.");
}

/// Build the finding reported when a directive carries no justification.
fn unjustified_diagnostic(directive: &Directive, path: &str) -> Diagnostic {
    return Diagnostic::new(
        "builtin",
        INVALID_RULE,
        Severity::Error,
        format!(
            "This rust-linter-{} directive has no justification, so it does not suppress anything.",
            directive.kind.name(),
        ),
        path,
        directive.span,
    )
    .with_help("Add a reason after `--`, as in `-- upstream API returns a raw pointer`.");
}

/// Build the finding reported when a directive suppressed nothing.
fn unused_diagnostic(directive: &Directive, path: &str, severity: Severity) -> Diagnostic {
    return Diagnostic::new(
        "builtin",
        UNUSED_RULE,
        severity,
        format!(
            "This rust-linter-{} directive suppresses nothing.",
            directive.kind.name(),
        ),
        path,
        directive.span,
    )
    .with_help("Remove it.");
}
