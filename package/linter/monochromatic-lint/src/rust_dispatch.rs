//! What: Run selected syntax-only Rust rules over one shared parse.
//! Why: Disabling semantic checking must avoid Cargo/toolchain initialization, not merely hide its diagnostics.
//!
//! In TS you'd write (pseudocode):
//! ```ts
//! // Dispatch only selected checks; workspace-backed annotation checking is added by the semantic session.
//! ```

/// Import owned findings and typed execution settings.
use crate::diagnostic::Diagnostic;
use crate::rust_rule_settings::{LineBudget, RustRuleSettings};
/// Import the actual shipped syntax checks.
use crate::rust_no_anonymous_functions::check_no_anonymous_functions;
use crate::rust_rules::{check_max_lines, check_rustdoc};
/// Borrow the already parsed source rather than reparsing per rule.
use crate::rust_source::RustSource;

/// Preserve fixed shipped-rule ordering while leaving absent/off rules unexecuted.
pub fn check_syntax_rules(source: &RustSource, settings: &RustRuleSettings) -> Vec<Diagnostic> {
    let mut findings: Vec<Diagnostic> = Vec::<Diagnostic>::new();
    if let Some(budget) = settings.max_lines {
        let selected: LineBudget = budget;
        findings.extend(check_max_lines(source, selected.max, selected.severity));
    }
    if let Some(severity) = settings.rustdoc {
        findings.extend(check_rustdoc(source, severity));
    }
    if let Some(severity) = settings.no_anonymous_functions {
        findings.extend(check_no_anonymous_functions(source, severity));
    }
    return findings;
}
